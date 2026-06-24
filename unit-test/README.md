# unit-tests — Login

Function-level login test for the Docker Manager backend. It lives in this
separate `unit-tests/` folder and runs from here, while calling the real login
function used by the main code.

Covered flows:

| File | Flow |
|------|------|
| `login_test.go` | Login function: `admin` / `admin123` returns username `admin` and a token |

## Prerequisites

1. **Go 1.21+** installed.
2. No running backend is required.
3. No MySQL or Docker engine is required.

## Running

```bash
cd unit-test
go test -v ./...
```

## Notes

- The test code runs from the `Unit Test/` path.
- The test passes only when the program login function accepts `admin` /
  `admin123` and returns a non-empty token.
