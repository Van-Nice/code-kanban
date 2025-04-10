# Type Conversion Utilities

This directory contains utility functions for converting between different type systems in the application.

## Type Systems

The application uses two main type systems:

1. **Shared Types** (`../shared/types.ts`): Used primarily in tests and UI components

   - Date fields are represented as ISO strings
   - Column objects don't require boardId or cardIds properties
   - Has Order property for UI rendering

2. **Model Types** (`../models/board.ts`): Used by storage layer and handlers
   - Date fields are represented as Date objects
   - Column objects require boardId and cardIds properties
   - Different structure for persistence

## Conversion Functions

The `type-conversions.ts` file provides utility functions to convert between these type systems:

- `convertToModelBoard`: Converts a shared Board to a model Board
- `convertToModelColumn`: Converts a shared Column to a model Column
- `convertToModelCard`: Converts a shared Card to a model Card
- `convertToSharedBoard`: Converts a model Board to a shared Board
- `convertToSharedColumn`: Converts a model Column to a shared Column
- `convertToSharedCard`: Converts a model Card to a shared Card

## Usage

Use these functions when crossing the boundary between the UI/test layer and the storage layer:

```typescript
// Convert before saving to storage
const modelBoard = convertToModelBoard(sharedBoard);
await storage.saveBoard(modelBoard);

// Convert for UI display
const sharedBoard = convertToSharedBoard(modelBoard);
return sharedBoard;
```

This approach allows the two type systems to coexist while maintaining type safety.
