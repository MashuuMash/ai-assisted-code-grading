import argparse
import getpass
import sys

from sqlalchemy import or_, select

from app.auth import get_password_hash
from app.database import SessionLocal
from app.models import User, UserRole


def create_user_cli() -> None:
    parser = argparse.ArgumentParser(description="Create a user account")
    parser.add_argument("--email", required=True, help="User email address")
    parser.add_argument("--username", required=True, help="Username")
    parser.add_argument("--full-name", required=True, help="User full name")
    parser.add_argument(
        "--role",
        required=True,
        choices=[r.value for r in UserRole],
        help="User role (admin, lecturer, student)",
    )

    args = parser.parse_args()

    password = getpass.getpass("Enter password: ")
    confirm_password = getpass.getpass("Confirm password: ")

    if password != confirm_password:
        print("Error: Passwords do not match", file=sys.stderr)
        sys.exit(1)

    if len(password) < 8:
        print("Error: Password must be at least 8 characters long", file=sys.stderr)
        sys.exit(1)

    with SessionLocal() as db:
        existing = db.scalar(
            select(User).where(or_(User.email == args.email, User.username == args.username))
        )
        if existing:
            print("Error: User with this email or username already exists", file=sys.stderr)
            sys.exit(1)

        user = User(
            email=args.email,
            username=args.username,
            full_name=args.full_name,
            hashed_password=get_password_hash(password),
            role=UserRole(args.role),
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        print(f"User created successfully: {user.username} (ID: {user.id}, Role: {user.role.value})")


if __name__ == "__main__":
    create_user_cli()
