package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"

	"caught-looking/backend/models"

	"golang.org/x/sync/errgroup"
)

const maxBatchTeams = 8
const batchTimelineConcurrency = 5

// RecordTimelinesBatch fetches several teams' record timelines in parallel (capped concurrency).
func (h *Handlers) RecordTimelinesBatch(w http.ResponseWriter, r *http.Request) {
	raw := strings.TrimSpace(r.URL.Query().Get("teamIds"))
	if raw == "" {
		respondAPIError(w, http.StatusBadRequest, "query teamIds is required (comma-separated team ids)")
		return
	}

	parts := strings.Split(raw, ",")
	seen := make(map[int]struct{})
	var teamIDs []int
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		id, err := strconv.Atoi(p)
		if err != nil || id <= 0 {
			respondAPIError(w, http.StatusBadRequest, "invalid team id in teamIds: "+p)
			return
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		teamIDs = append(teamIDs, id)
		if len(teamIDs) > maxBatchTeams {
			respondAPIError(w, http.StatusBadRequest, "at most "+strconv.Itoa(maxBatchTeams)+" teams")
			return
		}
	}
	if len(teamIDs) == 0 {
		respondAPIError(w, http.StatusBadRequest, "no valid team ids")
		return
	}

	sort.Ints(teamIDs)

	season := h.cfg.DefaultSeason
	if v := strings.TrimSpace(r.URL.Query().Get("season")); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1900 || n > 2100 {
			respondAPIError(w, http.StatusBadRequest, "invalid season")
			return
		}
		season = n
	}

	var keyParts []string
	for _, id := range teamIDs {
		keyParts = append(keyParts, strconv.Itoa(id))
	}
	cacheKey := "record-timelines-batch:" + strconv.Itoa(season) + ":" + strings.Join(keyParts, ",")
	body, err := h.cache.GetOrLoad(r.Context(), cacheKey, h.cfg.TTLScores, func(ctx context.Context) ([]byte, error) {
		g, ctx := errgroup.WithContext(ctx)
		sem := make(chan struct{}, batchTimelineConcurrency)

		results := make([][]byte, len(teamIDs))
		var mu sync.Mutex

		for i, tid := range teamIDs {
			i, tid := i, tid
			g.Go(func() error {
				select {
				case sem <- struct{}{}:
					defer func() { <-sem }()
				case <-ctx.Done():
					return ctx.Err()
				}
				b, err := h.getOrBuildRecordTimelineBytes(ctx, tid, season)
				if err != nil {
					return err
				}
				mu.Lock()
				results[i] = b
				mu.Unlock()
				return nil
			})
		}

		if err := g.Wait(); err != nil {
			return nil, err
		}

		timelines := make([]models.RecordTimelineResponse, 0, len(results))
		for _, b := range results {
			var tr models.RecordTimelineResponse
			if err := json.Unmarshal(b, &tr); err != nil {
				return nil, fmt.Errorf("%w: %w", errJSONDecode, err)
			}
			timelines = append(timelines, tr)
		}

		return marshalCachedJSON(models.RecordTimelinesBatchResponse{
			Season:    season,
			Timelines: timelines,
		})
	})
	if err != nil {
		respondGetOrLoadError(w, r, err)
		return
	}
	writeJSONBytes(w, body)
}
