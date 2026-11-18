# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Renamed the owned-card model, factory, and form to `Inventory`, `InventoryFactory`, and `InventoryForm`.
- Switched collection reads and writes to `users/{userId}/inventory` in Firestore.
- Centralized collection-entry creation, restoration, and editing copies in CollectionEntryFactory.
- Restored saved collection entries as validated models with document metadata kept separate.
- Protected collection-entry details with private fields and validated edits through `updateDetails()`.
- Separated card construction from Scryfall response formatting through CardFactory.
- Simplified restoration of saved cards when editing collection entries.
- Added printing-specific finish validation to card models.
- Lazy-loaded route views and separated Firestore initialization from authentication.
- Refined page headings and authentication form spacing.
- Restored the original blue primary color and light application background.
- Replaced starter documentation with project setup instructions.
- Converted the project scaffold from TypeScript to JavaScript.

### Added

- Added binder creation and listing, with name validation and owner-only Firestore access.
- Added automated checks for entry factories, isolated edits, Vue integration, and persistence serialization.
- Added collection entry deletion with confirmation, error feedback, and owner-only Firestore permissions.
- Added collection entry editing with prefilled ownership details and save feedback.
- Added validated owner-only Firestore updates while protecting card identity and creation timestamps.
- Added collection loading from Firestore with automatic refresh after saving.
- Added collection entry display with loading, error, retry, and empty states.
- Added paper printing selection with pagination and an ownership details form.
- Added collection entry creation in Firestore with saving, success, and error feedback.
- Prevented repeated submissions and dialog dismissal while a collection entry is saving.
- Added owner-only Firestore reads and validated creation rules for collection entries.
- Added Oracle IDs and an API function for retrieving a card's paper printings.
- Added shared Prettier configuration for consistent code formatting.
- Added Scryfall card search through a dedicated API module.
- Added an Add card dialog with search results, skeleton loaders, and error feedback.
- Added cancellation of pending searches when closing the dialog.
- Added a CollectionEntry model with ownership details and binder allocation validation.
- Added a Card model with required-field validation and double-faced image support.
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
