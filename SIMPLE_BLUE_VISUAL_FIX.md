# Simple Fix: Current Player Blue Visual for All Players

## ✅ Fixed

The blue background that shows which player should predict next is now visible to **all players**, not just the player whose turn it is.

## 🔧 What Changed

**Before:** 
```javascript
// Blue background only shown if current user could edit that field
backgroundColor: isActive && predictionEditable ? "#e3f2fd" : "inherit"
```

**After:**
```javascript  
// Blue background shown to everyone
backgroundColor: isActive ? "#e3f2fd" : "inherit"
```

## 🎮 Visual Indicators (All Visible to Everyone)

- 🔵 **Blue background**: Shows which player should predict next
- 🟠 **Orange border**: Shows last player (can't make total equal cards)  
- 📝 **Helper text**: "ΟΧΙ X" shows forbidden prediction numbers

All players can now see the same visual cues about whose turn it is and the game state, making the multiplayer experience much clearer!