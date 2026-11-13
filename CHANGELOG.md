# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Lazy-loaded route views and separated Firestore initialization from authentication.
- Refined page headings and authentication form spacing.
- Restored the original blue primary color and light application background.
- Replaced starter documentation with project setup instructions.
- Converted the project scaffold from TypeScript to JavaScript.

### Added
- Added Firebase email/password registration, sign-in, and sign-out.
- Added shared authentication state with Pinia and protected application routes.
- Added Firebase configuration examples and initial deny-all Firestore rules.
- Added a shared application layout with a header, content area, and footer.
- Added responsive navigation with desktop tabs and mobile bottom tabs.
- Added routes and initial views for Collection, Trade, and Binders.
- Documented the initial data model and ownership rules.
- Integrated Quasar components and Material Icons.
- Configured SCSS support and Quasar theme variables.
- Initial Vue and Vite project scaffold.

### Removed

- Removed unused Vue starter components and demo icons.