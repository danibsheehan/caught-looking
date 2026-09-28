package handlers

import (
	"math"
	"testing"
)

func Test_coerceStatFloat(t *testing.T) {
	tests := []struct {
		name   string
		v      interface{}
		wantF  float64
		wantOk bool
	}{
		{"float64", 3.21, 3.21, true},
		{"int", 4, 4, true},
		{"numeric string", "0.295", 0.295, true},
		{"string with whitespace", "  1.5 ", 1.5, true},
		{"empty string", "", 0, false},
		{"placeholder dot-dash", ".---", 0, false},
		{"placeholder dash-dot", "-.--", 0, false},
		{"unparseable string", "abc", 0, false},
		{"nil", nil, 0, false},
		{"unsupported type", []int{1}, 0, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f, ok := coerceStatFloat(tt.v)
			if ok != tt.wantOk {
				t.Fatalf("ok = %v, want %v", ok, tt.wantOk)
			}
			if math.Abs(f-tt.wantF) > 1e-9 {
				t.Fatalf("f = %v, want %v", f, tt.wantF)
			}
		})
	}
}

func Test_coerceStatInt(t *testing.T) {
	tests := []struct {
		name   string
		v      interface{}
		wantN  int
		wantOk bool
	}{
		{"float64", float64(7), 7, true},
		{"int", 7, 7, true},
		{"integer string", "42", 42, true},
		{"decimal string falls back to float", "1.0", 1, true},
		{"decimal string truncates", "1.9", 1, true},
		{"string with whitespace", " 5 ", 5, true},
		{"empty string", "", 0, false},
		{"placeholder dash-dot", "-.--", 0, false},
		{"unparseable string", "abc", 0, false},
		{"nil", nil, 0, false},
		{"unsupported type", []int{1}, 0, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			n, ok := coerceStatInt(tt.v)
			if ok != tt.wantOk {
				t.Fatalf("ok = %v, want %v", ok, tt.wantOk)
			}
			if n != tt.wantN {
				t.Fatalf("n = %v, want %v", n, tt.wantN)
			}
		})
	}
}
