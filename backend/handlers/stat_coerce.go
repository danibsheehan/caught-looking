package handlers

import (
	"strconv"
	"strings"
)

// isPlaceholderStat reports whether s is one of MLB's placeholder strings for "no stat"
// (e.g. a rate stat with zero opportunities), which should be treated as absent, not zero-value-but-present.
func isPlaceholderStat(s string) bool {
	switch s {
	case "", ".---", "-.--":
		return true
	default:
		return false
	}
}

// coerceStatFloat converts an MLB stat JSON value (float64/int/string) to a float64.
// ok is false when v is absent, a placeholder, or unparseable.
func coerceStatFloat(v interface{}) (f float64, ok bool) {
	switch t := v.(type) {
	case float64:
		return t, true
	case int:
		return float64(t), true
	case string:
		s := strings.TrimSpace(t)
		if isPlaceholderStat(s) {
			return 0, false
		}
		f, err := strconv.ParseFloat(s, 64)
		if err != nil {
			return 0, false
		}
		return f, true
	default:
		return 0, false
	}
}

// coerceStatInt converts an MLB stat JSON value (float64/int/string) to an int.
// String values are tried as an integer first, then fall back to float parsing (e.g. "1.0" -> 1).
// ok is false when v is absent, a placeholder, or unparseable.
func coerceStatInt(v interface{}) (n int, ok bool) {
	switch t := v.(type) {
	case float64:
		return int(t), true
	case int:
		return t, true
	case string:
		s := strings.TrimSpace(t)
		if isPlaceholderStat(s) {
			return 0, false
		}
		if n, err := strconv.Atoi(s); err == nil {
			return n, true
		}
		if f, err := strconv.ParseFloat(s, 64); err == nil {
			return int(f), true
		}
		return 0, false
	default:
		return 0, false
	}
}
