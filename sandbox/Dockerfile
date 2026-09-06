FROM python:3.12-slim

# Prevent writing .pyc files and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install pytest and plugins
RUN pip install --no-cache-dir pytest pytest-timeout

# Create non-root unprivileged sandbox user
RUN groupadd -g 10001 sandboxgroup && \
    useradd -u 10001 -g sandboxgroup -s /sbin/nologin -d /sandbox sandbox_user && \
    mkdir -p /sandbox && \
    chown -R sandbox_user:sandboxgroup /sandbox

WORKDIR /sandbox
USER sandbox_user

# Entrypoint script
COPY runner.py /sandbox/runner.py

ENTRYPOINT ["python", "/sandbox/runner.py"]
