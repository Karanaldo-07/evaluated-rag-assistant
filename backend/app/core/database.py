from contextlib import contextmanager
from psycopg_pool import ConnectionPool
from pgvector.psycopg import register_vector
from app.core.config import settings


def _configure_connection(conn):
    register_vector(conn)


pool = ConnectionPool(
    conninfo=settings.DATABASE_URL,
    min_size=1,
    max_size=5,
    kwargs={"prepare_threshold": None},
    configure=_configure_connection,
    open=False,
)


@contextmanager
def get_db_conn():
    with pool.connection() as conn:
        yield conn