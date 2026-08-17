FROM python:3.11-alpine

RUN pip install --no-cache-dir pytest==8.3.5 \
    && addgroup -g 10001 grader \
    && adduser -D -u 10001 -G grader grader \
    && mkdir /workspace \
    && chown grader:grader /workspace

WORKDIR /workspace
USER 10001:10001

CMD ["python", "--version"]
