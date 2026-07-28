package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"caught-looking/backend/models"

	"golang.org/x/sync/errgroup"
)

type mlbPeopleStatSplitsPayload struct {
	Stats []struct {
		Splits []struct {
			Season string `json:"season"`
			Split  struct {
				Code        string `json:"code"`
				Description string `json:"description"`
			} `json:"split"`
			Stat   json.RawMessage `json:"stat"`
			Player struct {
				ID       int64  `json:"id"`
				FullName string `json:"fullName"`
			} `json:"player"`
		} `json:"splits"`
	} `json:"stats"`
}

// PlayersComparePlatoon returns vs-L / vs-R regular-season splits (MLB statSplits sitCodes vl,vr).
// Hitting: batter OPS vs LHP and vs RHP. Pitching: opponent OPS vs LHB and vs RHB (ERA is often absent on these splits).
func (h *Handlers) PlayersComparePlatoon(w http.ResponseWriter, r *http.Request) {
	ids := strings.TrimSpace(r.URL.Query().Get("ids"))
	parts := strings.Split(ids, ",")
	if len(parts) != 2 {
		respondAPIError(w, http.StatusBadRequest, "query ids must be two comma-separated MLB person ids")
		return
	}
	id1, err1 := strconv.ParseInt(strings.TrimSpace(parts[0]), 10, 64)
	id2, err2 := strconv.ParseInt(strings.TrimSpace(parts[1]), 10, 64)
	if err1 != nil || err2 != nil || id1 <= 0 || id2 <= 0 {
		respondAPIError(w, http.StatusBadRequest, "invalid ids")
		return
	}

	group := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("group")))
	if group == "" {
		group = "hitting"
	}
	if group != "hitting" && group != "pitching" {
		respondAPIError(w, http.StatusBadRequest, "query group must be hitting or pitching")
		return
	}

	season := h.cfg.DefaultSeason
	if v := strings.TrimSpace(r.URL.Query().Get("season")); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1900 || n > 2100 {
			respondAPIError(w, http.StatusBadRequest, "invalid season")
			return
		}
		season = n
	}

	cacheKey := "players-platoon:" + strconv.FormatInt(id1, 10) + ":" + strconv.FormatInt(id2, 10) + ":" + group + ":" + strconv.Itoa(season)
	body, err := h.cache.GetOrLoad(r.Context(), cacheKey, h.cfg.TTLStandings, func(ctx context.Context) ([]byte, error) {
		g, gctx := errgroup.WithContext(ctx)
		var a, b models.PlatoonPlayer
		g.Go(func() error {
			var err error
			a, err = h.fetchPlayerPlatoonSplits(gctx, id1, group, season)
			return err
		})
		g.Go(func() error {
			var err error
			b, err = h.fetchPlayerPlatoonSplits(gctx, id2, group, season)
			return err
		})
		if err := g.Wait(); err != nil {
			return nil, err
		}

		out := models.PlayersPlatoonResponse{
			Season:  season,
			Group:   group,
			Metric:  "ops",
			Players: []models.PlatoonPlayer{a, b},
		}
		return marshalCachedJSON(out)
	})
	if err != nil {
		respondGetOrLoadError(w, r, err)
		return
	}
	writeJSONBytes(w, body)
}

func (h *Handlers) fetchPlayerPlatoonSplits(ctx context.Context, id int64, group string, season int) (models.PlatoonPlayer, error) {
	q := url.Values{}
	q.Set("stats", "statSplits")
	q.Set("group", group)
	q.Set("season", strconv.Itoa(season))
	q.Set("sportId", "1")
	q.Set("sitCodes", "vl,vr")
	path := "/people/" + strconv.FormatInt(id, 10) + "/stats?" + q.Encode()

	raw, err := h.mlb.Get(ctx, path)
	if err != nil {
		return models.PlatoonPlayer{}, err
	}

	var payload mlbPeopleStatSplitsPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return models.PlatoonPlayer{}, err
	}

	out := models.PlatoonPlayer{ID: id}
	if len(payload.Stats) == 0 || len(payload.Stats[0].Splits) == 0 {
		return out, nil
	}

	byCode := map[string]models.PlatoonSplitRow{}
	for _, sp := range payload.Stats[0].Splits {
		if sp.Player.FullName != "" {
			out.FullName = sp.Player.FullName
		}
		if sp.Player.ID != 0 {
			out.ID = sp.Player.ID
		}
		code := strings.ToLower(strings.TrimSpace(sp.Split.Code))
		if code != "vl" && code != "vr" {
			continue
		}
		var statMap map[string]interface{}
		if err := json.Unmarshal(sp.Stat, &statMap); err != nil {
			continue
		}
		ops := statFloat(statMap["ops"])
		if ops < 0 {
			continue
		}
		sample := int(statFloat(statMap["plateAppearances"]))
		if sample == 0 && group == "pitching" {
			sample = int(statFloat(statMap["battersFaced"]))
		}
		desc := strings.TrimSpace(sp.Split.Description)
		if desc == "" {
			if code == "vl" {
				if group == "pitching" {
					desc = "vs LHB"
				} else {
					desc = "vs LHP"
				}
			} else {
				if group == "pitching" {
					desc = "vs RHB"
				} else {
					desc = "vs RHP"
				}
			}
		}
		byCode[code] = models.PlatoonSplitRow{
			Code:        code,
			Description: desc,
			Ops:         ops,
			Sample:      sample,
		}
	}

	for _, code := range []string{"vl", "vr"} {
		if row, ok := byCode[code]; ok {
			out.Splits = append(out.Splits, row)
		}
	}
	return out, nil
}
