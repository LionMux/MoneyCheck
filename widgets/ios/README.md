# FinWise iOS Widget

SwiftUI widget that shows your current balance, monthly income/expenses and learning streak directly on the iOS home screen.

## Requirements
- iOS 16+
- Xcode 14+
- FinWise backend running (locally or deployed)

## Setup

### 1. Create Widget Extension
1. Open your Xcode project
2. File → New → Target → Widget Extension
3. Name it `FinWiseWidget`
4. Uncheck "Include Configuration App Intent" (we use Static Configuration)

### 2. Add the code
Copy `FinWiseWidget.swift` into the new widget target, replacing the default file.

### 3. Configure API URL
In `FinWiseWidget.swift`, update:
```swift
static let baseURL = "https://your-finwise-backend.com"
```

### 4. Backend widget endpoint
The widget hits `GET /api/widget/summary`. Add this route to `server/routes.ts`:
```ts
app.get("/api/widget/summary", guard, async (req, res) => {
  const userId = getUserId(req as AuthRequest);
  // return totalBalance, monthIncome, monthExpense, streak, level, totalXp
});
```

## Supported Sizes
- **Small** — Balance + streak/level
- **Medium** — Balance + monthly income & expenses + streak

## Deep Links
The widget links back to the app. Implement `onOpenURL` in your SwiftUI App or AppDelegate to handle `finwise://` scheme URLs.
