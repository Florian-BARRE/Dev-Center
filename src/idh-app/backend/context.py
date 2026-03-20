# ====== Code Summary ======
# Shared application context — typed service locator.
# Type annotations only. All values assigned at startup in entrypoint.py.

# ====== Standard Library Imports ======
from typing import Type

# ====== Third-Party Library Imports ======
from loggerplusplus import LoggerPlusPlus

# ====== Internal Project Imports ======
from config import RUNTIME_CONFIG


class CONTEXT:
    """
    Shared application context — typed service locator.

    All attributes assigned in entrypoint.py before create_app() is called.
    Never instantiate this class — access attributes at class level.
    """

    logger: LoggerPlusPlus
    RUNTIME_CONFIG: Type[RUNTIME_CONFIG]
