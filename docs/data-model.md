# Data Model

## Purpose

Card Grimoire separates card information from ownership, wishlists,
and trade history. Models and factories use plain JavaScript and
contain no Vue or Firebase code.

Dedicated data-access modules handle API and database operations.

## User ownership

Each user's private data lives under their Firebase Authentication UID:

- users/{userId}
- users/{userId}/collectionEntries/{entryId}
- users/{userId}/binders/{binderId}
- users/{userId}/wishlistEntries/{wishlistEntryId}
- users/{userId}/trades/{tradeId}

Firebase Authentication manages credentials. Application documents
must not store passwords.

Firestore rules must restrict access to the owning user.

## Card printing

Represents a specific printing returned by Scryfall.

Fields:

- scryfallId: unique printing identifier.
- name: card name.
- typeLine: card type description.
- setCode: set identifier.
- setName: readable set name.
- collectorNumber: string, because numbers may include letters.
- rarity: printing rarity.
- imageUrl: card image, with a fallback for double-faced cards.

Card printing information is embedded in collection entries,
wishlist entries, and trade snapshots.

A printing identifier does not identify an owned collection entry.
Several owned entries may reference the same printing.

## Collection entry

Represents a group of owned copies with matching printing,
condition, finish, and purchase cost.

Fields:

- card: card printing information.
- quantity: positive integer.
- condition: supported card condition.
- finish: nonfoil, foil, or etched; must be available for the printing.
- favorite: boolean.
- availableForTrade: boolean.
- purchasePriceMinor: optional per-copy cost in integer minor units;
  null means unknown, while zero means free.
- currency: currency code; initially USD.
- binderQuantities: map of binder IDs to assigned copy counts.
- createdAt: creation timestamp.
- updatedAt: most recent modification timestamp.

The Firestore document ID identifies the entry. Data-access modules
expose it as id when reading the document into the application.

Market estimates are separate from purchase costs. Unknown prices
must not be treated as zero.

## Binder

Organizes owned copies without duplicating ownership.

Fields:

- name: trimmed, nonempty name.
- description: optional text.
- color: supported binder color.
- createdAt: creation timestamp.
- updatedAt: most recent modification timestamp.

Collection entries hold binder assignments. Binders do not maintain
a second list of their cards.

Assignment rules:

- Every assigned quantity must be a positive integer.
- Total assigned quantity cannot exceed the entry's owned quantity.
- Assignments must reference the same user's binders.
- Removing an assignment leaves those copies unassigned.
- Deleting a binder preserves the owned cards and removes its assignments.
- Reducing owned quantity must also resolve any excess assignments.

Favorites is a filtered view of collection entries, not a stored binder.

## Wishlist entry

Tracks a wanted card separately from owned cards.

Initial scope: each wishlist entry targets a specific printing.

Fields:

- card: card printing information.
- desiredQuantity: positive integer.
- preferredFinish: supported finish, or null for no preference.
- notes: optional text.
- createdAt: creation timestamp.
- updatedAt: most recent modification timestamp.

Wishlist quantities do not contribute to collection totals.

## Saved trade

Preserves a completed trade independently of later collection changes.

Fields:

- given: array of outgoing card snapshots.
- received: array of incoming card snapshots.
- completedAt: date and time of the trade.
- createdAt: date and time the record was saved.
- notes: optional text.
- currency: currency code; initially USD.

Each snapshot includes:

- Card printing information.
- Quantity.
- Condition.
- Finish.
- Recorded per-copy value in integer minor units, or null if unknown.

Historical values must not change when market prices change.

Recording a completed trade and adjusting owned quantities must
succeed together or leave both unchanged. Repeated submission must
not apply the same trade twice.

## Dashboard

Calculate dashboard summaries from collection data initially.

- Count ownership using collection-entry quantities.
- Do not count binder assignments as additional owned copies.
- Exclude wishlist entries from owned totals.
- Identify missing prices when displaying estimated collection value.

## Validation and persistence

Forms provide immediate feedback. Models validate domain rules.
Firestore rules enforce authorization and supported data constraints.

Data-access modules convert models into plain Firestore document data
and restore application objects when reading.

Document IDs and persistence timestamps are handled by data-access
modules, keeping Firebase dependencies out of domain models.