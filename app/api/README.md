# Backend API for the ssc-assitant.

This api is exposed to the frontend and other teams (MySSC Plus).

## devs

To run the application simply do `cd app/api` then `flask --debug run --port=5001`

## generating new keys

[Documentation on how to generate a new key](https://pyjwt.readthedocs.io/en/stable/)

```python
import jwt
encoded_jwt = jwt.encode({'roles': ['feedback', 'chat']}, 'secret', algorithm='HS256')
print(encoded_jwt)
```

Use this token for testing: `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6WyJmZWVkYmFjayIsImNoYXQiXX0.d91fM8UyKsP2c_3rJQqrkESudlZPZpTRifidN8jghtI`

## Local postgres

To work with the `/suggest` endpoint, you will need to set up a local postgres. For example...


```sql
CREATE USER someuser WITH PASSWORD 'somepassword';
CREATE DATABASE somedatabase;
GRANT ALL ON DATABASE somedatabase TO someuser;
\c somedatabase someuser
# You are now connected to database "somedatabase" as user "someuser".
GRANT ALL ON SCHEMA public TO someuser;
```

Then, set up your `SQL_CONNECTION_STRING` variable accordingly.

```bash
# .env
SQL_CONNECTION_STRING=postgresql+psycopg://someuser:somepassword@localhost:5432/somedatabase
```

Then run `alembic upgrade head` to run migrations.

## Running alembic

Alembic is used to manage our db version history. It accesses the `.env` used by the API inside `env.py`.

```bash
# Run all of these scripts from the root of the api project.

# reset database
alembic downgrade base && alembic upgrade head

# create migration
alembic revision -m "create suggestion table"
```