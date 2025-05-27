#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Store the root directory
ROOT_DIR=$(pwd)

echo -e "${BLUE}Starting test suite for all components...${NC}\n"

# Function to run tests in a directory
run_tests() {
    local dir=$1
    local name=$2
    
    echo -e "${BLUE}Running tests for ${name}...${NC}"
    cd "$ROOT_DIR/$dir" || exit 1
    
    if npm test; then
        echo -e "${GREEN}✓ ${name} tests passed${NC}\n"
        cd "$ROOT_DIR" || exit 1
        return 0
    else
        echo -e "${RED}✗ ${name} tests failed${NC}\n"
        cd "$ROOT_DIR" || exit 1
        return 1
    fi
}

# Track overall success
success=true

# Run frontend tests
run_tests "frontend" "Frontend" || success=false

# Run API tests
run_tests "api" "API" || success=false

# Run backend tests
run_tests "backend" "Backend" || success=false

# Final status
if [ "$success" = true ]; then
    echo -e "${GREEN}All test suites passed!${NC}"
    exit 0
else
    echo -e "${RED}Some test suites failed.${NC}"
    exit 1
fi 