# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Moved binder assignment into a dedicated dialog. Collection refreshes after assignments are saved or removed.
- Centralized assigned and unassigned copy counts in `Inventory` so binder limits and trade availability use the same calculation.
- Moved trade confirmation state into `useTradeConfirmation`, including the trade ID and recorded prices used on retry.
- Added JSDoc types for nullable auth and binder state and collection records to resolve WebStorm inspections.
- Arranged Trade into side-by-side Giving and Receiving panels on desktop and stacked panels on mobile.
- Reused card search, printing pagination, and cancellation between Collection and Trade.
- Shared card condition choices and Firestore inventory document formatting across the forms and services that use them.
- Grouped Collection rows by printing and showed their combined copy and variant counts.
- Reworked the Collection action menu into a desktop dialog and a mobile bottom sheet, with entry selection for printings that have multiple saved variants.
- Guided Add Card through search, printing selection, and collection details, with clickable printing rows and visible finish choices.
- Improved binder assignment controls with the current and maximum copy counts, a save action, and an explicit removal action.
- Refined binder tiles and contents, and moved binder creation into a dedicated dialog.
- Aligned Add card and New binder with their page headings on desktop and used floating add buttons on mobile.
- Adjusted Collection and Binders loading placeholders to fit the available screen space, and lazy-loaded card thumbnails.
- Documented trade draft types, the binder service, and card and binder dialog handoffs with JSDoc.
- Moved collection row actions into a compact menu beside the quantity badge.
- Replaced binder dropdowns with a card grid, matching loading skeletons, and a separate contents view.
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

- Added a History tab that lists completed trades newest first and shows each printing, condition, finish, quantity, and recorded price per copy.
- Added a regression test for assigned and unassigned copy counts after binder and inventory edits.
- Added the Receiving side of a trade draft with Scryfall printing selection and condition, finish, and quantity controls.
- Added estimated USD prices per copy and per side, with a value difference when both sides have complete pricing.
- Added a review and confirmation flow that updates inventory and saves an owner-only trade record in one Firestore transaction. Confirmation retries reuse the same trade ID, and outgoing copies assigned to binders are protected.
- Added automated checks for card lookup pagination and cancellation.
- Added the Giving side of a trade draft with inventory search, variant selection, and quantity controls limited to copies outside binders.
- Added local card-name search and A–Z or Z–A sorting to the Collection page.
- Added a centered card details dialog with owned variants, an Add another action for the same printing, and an image preview that enlarges when tapped or clicked.
- Added binder assignments from the Collection page, with Firestore validation that keeps assigned copies within the owned quantity.
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
