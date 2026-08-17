import argparse
import getpass

from sqlalchemy import or_, select

from app.auth import hash_password
from app.database import SessionLocal
from app.models import User, UserRole


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a platform administrator or lecturer")
    parser.add_argument("--email", required=True)
    parser.add_argument("--username", required=True)
    parser.add_argument("--full-name", required=True)
    parser.add_argument("--role", required=True, choices=[UserRole.ADMIN.value, UserRole.LECTURER.value])
    args = parser.parse_args()
    password = getpass.getpass("Password (12-72 characters): ")
    if not 12 <= len(password) <= 72:
        parser.error("password must contain 12-72 characters")
    with SessionLocal() as db:
        duplicate = db.scalar(
            select(User.id).where(or_(User.email == args.email.lower(), User.username == args.username))
        )
        if duplicate is not None:
            parser.error("email or username already exists")
        db.add(
            User(
                email=args.email.lower(),
                username=args.username,
                full_name=args.full_name,
                role=UserRole(args.role),
                hashed_password=hash_password(password),
            )
        )
        db.commit()
    print(f"Created {args.role} account {args.email.lower()}")


if __name__ == "__main__":
    main()
