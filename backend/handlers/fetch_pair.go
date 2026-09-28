package handlers

import (
	"context"

	"golang.org/x/sync/errgroup"
)

// fetchPairConcurrently runs fn for id1 and id2 in parallel via errgroup, returning both results.
// If either call errors, err is non-nil and the partial results should be discarded by the caller.
func fetchPairConcurrently[T any](ctx context.Context, id1, id2 int64, fn func(context.Context, int64) (T, error)) (t1, t2 T, err error) {
	g, gctx := errgroup.WithContext(ctx)
	g.Go(func() error {
		var e error
		t1, e = fn(gctx, id1)
		return e
	})
	g.Go(func() error {
		var e error
		t2, e = fn(gctx, id2)
		return e
	})
	err = g.Wait()
	return t1, t2, err
}
