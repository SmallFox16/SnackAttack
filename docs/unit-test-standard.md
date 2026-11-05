# Unit Testing Standard

## Purpose
Establish consistent guidelines for writing unit tests throughout SnackAttack. Unit tests should verify that individual JavaScript functions behave as expected and help developers identify problems when making changes to existing functionality.

## 1. What Should Be Tested

Developers should prioritize testing JavaScript functions that contain application logic, including:

- **Data processing:** Functions that retrieve, organize, filter, or display vending machine and product information.
- **Search and filtering:** Functions that locate vending machines or filter products based on user input.
- **Input validation:** Functions that validate user input or handle missing or invalid information.
- **Map functionality:** Functions that process vending machine locations or provide location data to the Leaflet map.
- **Availability and stock:** Functions that process or update vending machine availability and product information.

Simple HTML structure, CSS styling, and static content generally do not require unit tests.

## 2. Test Case Requirements

When writing unit tests, developers should consider the following scenarios:

- **Normal operation:** Does the function produce the expected result with valid input?
- **Empty or missing data:** Does the function handle empty arrays, missing values, or null inputs appropriately?
- **Invalid input:** Does the function respond appropriately to unexpected or incorrectly formatted data?
- **Boundary conditions:** Does the function behave correctly with unusual or extreme values?
- **Error handling:** Does the function handle errors without causing unexpected behavior?

Not every function requires every scenario. Developers should select test cases based on the function's purpose and expected behavior.

## 3. Test Structure

Unit tests should follow the Arrange-Act-Assert pattern:

1. **Arrange:** Prepare the inputs and any required test data.
2. **Act:** Execute the function being tested.
3. **Assert:** Verify that the actual result matches the expected result.

Each test should focus on one specific behavior and have a descriptive name explaining what it verifies.

## 4. Testing Guidelines

- Test individual functions independently whenever possible.
- Avoid depending on external services, live APIs, or actual databases during unit tests.
- Use mock data when testing functions that process vending machine or product information.
- Keep tests repeatable so that running them multiple times produces consistent results.
- Avoid testing third-party library functionality, such as Leaflet's internal map operations. Focus on the application's own code that interacts with those libraries.

## 5. Test Organization and Maintenance

- Store unit tests in a dedicated test directory.
- Use filenames that clearly identify the functionality being tested.
- Update existing tests when modifying the behavior of previously tested functions.
- Add appropriate tests when introducing new functionality.
- Run relevant tests before merging changes into the main branch.
- Developers should communicate any functionality that cannot reasonably be unit tested and explain why.

## 6. Unit Testing vs. Other Quality Checks

Unit testing is different from other forms of software testing and code quality checks.

- **Unit testing:** Verifies that individual JavaScript functions produce the expected results.
- **Accessibility testing:** Checks that the application is accessible to users with disabilities, including automated checks using axe-core.
- **End-to-end testing:** Verifies that complete application workflows function correctly.
- **Linting:** Uses tools such as JSLint to identify potential JavaScript errors and enforce coding conventions.

These practices complement one another and should not be treated as interchangeable.