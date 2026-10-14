"""Wait for the database before migrating and serving requests."""
import logging
import os
import subprocess
import time

from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.database import engine


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    for attempt in range(60):
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            break
        except OperationalError:
            if attempt == 59:
                raise RuntimeError("Database unavailable after startup retries") from None
            logging.warning("Database not ready; retrying (%s/60)", attempt + 1)
            time.sleep(2)
    engine.dispose()
    subprocess.run(["alembic", "upgrade", "head"], check=True)
    os.execvp("uvicorn", ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"])


if __name__ == "__main__":
    main()
