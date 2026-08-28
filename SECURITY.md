# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.x     | Yes       |
| < 1.0   | No        |

## Reporting a Vulnerability

Please report suspected vulnerabilities privately.

- Preferred: GitHub private vulnerability reporting (Security tab)
- Alternative: email jose@nubisco.io with the subject `Security: cms-core`

Please do not open public GitHub issues for security reports before disclosure is coordinated.

## What to Include

Please provide as much detail as possible:

- Affected package version
- A clear description of the issue and impact
- Steps to reproduce or proof-of-concept details
- Any suggested remediation

## Scope

This package renders content served by a Nubisco CMS delivery API. Reports that
concern how authored content is normalised, resolved or emitted are in scope,
particularly anything that could turn authored data into executed script in a
consuming site.

Vulnerabilities in a consuming application's own code, or in the CMS service
itself, belong to those projects rather than here.

## Response

We aim to acknowledge a report within a few working days and to keep you updated
while a fix is prepared. Credit is given in the release notes unless you would
rather remain anonymous.
