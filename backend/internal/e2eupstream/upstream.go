// Package e2eupstream serves minimal MLB Stats API + Baseball Savant fixture
// responses for contract-aware Playwright (Go API → fixtures, no live MLB).
package e2eupstream

import (
	"net/http"
	"strings"
)

// Fixed slate used by frontend/e2e contract smoke (keep in sync with contract.spec.ts).
const (
	ContractDate   = "2026-04-22"
	ContractGamePk = "662000"
)

const standingsJSON = `{
  "records": [
    {
      "division": {"id": 201, "name": "East"},
      "league": {"id": 104},
      "teamRecords": [
        {
          "team": {"id": 121, "name": "Away"},
          "gamesPlayed": 15,
          "divisionRank": "1",
          "wildCardGamesBack": "-",
          "gamesBack": "-",
          "runsScored": 55,
          "runsAllowed": 44,
          "runDifferential": 11,
          "streak": {"streakCode": "W2"},
          "records": {
            "splitRecords": [
              {"type": "home", "wins": 5, "losses": 1},
              {"type": "away", "wins": 5, "losses": 4},
              {"type": "lastTen", "wins": 6, "losses": 4}
            ]
          },
          "leagueRecord": {"wins": 10, "losses": 5, "pct": ".667"}
        },
        {
          "team": {"id": 144, "name": "Home"},
          "gamesPlayed": 15,
          "divisionRank": "2",
          "wildCardGamesBack": "-",
          "gamesBack": "1.0",
          "runsScored": 48,
          "runsAllowed": 50,
          "runDifferential": -2,
          "streak": {"streakCode": "L1"},
          "records": {
            "splitRecords": [
              {"type": "home", "wins": 5, "losses": 2},
              {"type": "away", "wins": 4, "losses": 4},
              {"type": "lastTen", "wins": 5, "losses": 5}
            ]
          },
          "leagueRecord": {"wins": 9, "losses": 6, "pct": ".600"}
        }
      ]
    }
  ]
}`

const divisionsJSON = `{"divisions":[{"id":201,"name":"NL East"}]}`

const teamsJSON = `{
  "teams": [
    {
      "id": 121,
      "name": "Away",
      "abbreviation": "AWY",
      "teamName": "Away",
      "active": true,
      "league": {"id": 104, "name": "National League"},
      "division": {"id": 201, "name": "NL East"}
    },
    {
      "id": 144,
      "name": "Home",
      "abbreviation": "HME",
      "teamName": "Home",
      "active": true,
      "league": {"id": 104, "name": "National League"},
      "division": {"id": 201, "name": "NL East"}
    }
  ]
}`

const scheduleForDateJSON = `{
  "dates": [
    {
      "date": "` + ContractDate + `",
      "games": [
        {
          "gamePk": ` + ContractGamePk + `,
          "officialDate": "` + ContractDate + `",
          "status": {"detailedState": "Final", "abstractGameState": "Final"},
          "teams": {
            "away": {"team": {"id": 121, "name": "Away"}, "score": 3},
            "home": {"team": {"id": 144, "name": "Home"}, "score": 2}
          },
          "venue": {"id": 3309, "name": "Fixture Park"}
        }
      ]
    }
  ]
}`

const scheduleByPkJSON = `{
  "dates": [
    {
      "games": [
        {
          "gamePk": ` + ContractGamePk + `,
          "status": {"detailedState": "Final", "abstractGameState": "Final"},
          "venue": {"id": 3309, "name": "Fixture Park"}
        }
      ]
    }
  ]
}`

const scheduleTeamSeasonJSON = `{
  "dates": [
    {
      "games": [
        {
          "officialDate": "` + ContractDate + `",
          "gameDate": "` + ContractDate + `T18:05:00Z",
          "status": {"abstractGameState": "Final"},
          "isTie": false,
          "teams": {
            "away": {"team": {"id": 121}, "isWinner": true},
            "home": {"team": {"id": 144}, "isWinner": false}
          }
        }
      ]
    }
  ]
}`

const boxscoreJSON = `{
  "teams": {
    "away": {
      "team": {"id": 121, "name": "Away"},
      "teamStats": {
        "batting": {"runs": 3, "hits": 8, "leftOnBase": 5, "doubles": 1, "triples": 0, "homeRuns": 1},
        "pitching": {},
        "fielding": {"errors": 0}
      },
      "batters": [1001],
      "pitchers": [2001],
      "players": {
        "ID1001": {
          "person": {"id": 1001, "fullName": "Away Batter"},
          "position": {"abbreviation": "LF"},
          "stats": {"batting": {"atBats": 4, "plateAppearances": 4, "runs": 1, "hits": 2, "doubles": 0, "triples": 0, "homeRuns": 0, "rbi": 1, "baseOnBalls": 0, "strikeOuts": 1}}
        },
        "ID2001": {
          "person": {"id": 2001, "fullName": "Away Pitcher"},
          "position": {"abbreviation": "P"},
          "stats": {"pitching": {"inningsPitched": "7.0", "hits": 4, "runs": 2, "earnedRuns": 2, "baseOnBalls": 1, "strikeOuts": 6, "homeRuns": 0}}
        }
      }
    },
    "home": {
      "team": {"id": 144, "name": "Home"},
      "teamStats": {
        "batting": {"runs": 2, "hits": 6, "leftOnBase": 4, "doubles": 0, "triples": 1, "homeRuns": 0},
        "pitching": {},
        "fielding": {"errors": 1}
      },
      "batters": [1002],
      "pitchers": [2002],
      "players": {
        "ID1002": {
          "person": {"id": 1002, "fullName": "Home Batter"},
          "position": {"abbreviation": "SS"},
          "stats": {"batting": {"atBats": 3, "plateAppearances": 4, "runs": 0, "hits": 1, "doubles": 0, "triples": 0, "homeRuns": 0, "rbi": 0, "baseOnBalls": 1, "strikeOuts": 2}}
        },
        "ID2002": {
          "person": {"id": 2002, "fullName": "Home Pitcher"},
          "position": {"abbreviation": "P"},
          "stats": {"pitching": {"inningsPitched": "7.0", "hits": 5, "runs": 3, "earnedRuns": 3, "baseOnBalls": 2, "strikeOuts": 5, "homeRuns": 1}}
        }
      }
    }
  }
}`

const linescoreJSON = `{
  "innings": [
    {"num": 1, "home": {"runs": 0}, "away": {"runs": 1}},
    {"num": 2, "home": {"runs": 2}, "away": {"runs": 2}}
  ],
  "teams": {
    "home": {"runs": 2},
    "away": {"runs": 3}
  },
  "status": {
    "detailedState": "Final",
    "abstractGameState": "Final"
  }
}`

// Combined Savant CSV: batted-ball rows need launch_speed/angle; pitch rows need plate_x/z.
// Pitcher ids match boxscore pitchers (2001 away / 2002 home) so SPA density maps resolve names.
const statcastCSV = `launch_speed,launch_angle,batter,pitcher,player_name,events,inning_topbot,hc_x,hc_y,plate_x,plate_z,pitch_name,pitch_type,release_speed,sz_top,sz_bot,stand
95.1,12.2,1001,2001,Away Batter,single,Top,130.0,45.0,-0.42,2.15,4-Seam Fastball,FF,94.2,3.41,1.74,R
88.0,-5.0,1002,2002,Home Batter,grounded_into_double_play,Bot,118.0,12.0,0.31,3.05,Slider,SL,87.0,3.37,1.79,R
,,,2001,,,,,-0.2,2.1,4-Seam Fastball,FF,95.0,3.41,1.74,R
,,,2001,,,,,0.4,3.0,Slider,SL,86.5,3.41,1.74,R
`

// Handler returns the fixture mux (MLB JSON paths + Savant CSV + /health).
func Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		path := r.URL.Path
		switch {
		case path == "/standings":
			writeJSON(w, standingsJSON)
		case path == "/divisions":
			writeJSON(w, divisionsJSON)
		case path == "/teams":
			writeJSON(w, teamsJSON)
		case path == "/schedule":
			serveSchedule(w, r)
		case path == "/game/"+ContractGamePk+"/boxscore":
			writeJSON(w, boxscoreJSON)
		case path == "/game/"+ContractGamePk+"/linescore":
			writeJSON(w, linescoreJSON)
		case path == "/statcast_search/csv":
			if !strings.Contains(r.URL.RawQuery, "game_pk="+ContractGamePk) {
				http.NotFound(w, r)
				return
			}
			w.Header().Set("Content-Type", "text/csv; charset=utf-8")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(statcastCSV))
		default:
			http.NotFound(w, r)
		}
	})
	return mux
}

func serveSchedule(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	switch {
	case q.Get("date") == ContractDate:
		writeJSON(w, scheduleForDateJSON)
	case q.Get("gamePks") == ContractGamePk:
		writeJSON(w, scheduleByPkJSON)
	case q.Get("teamId") != "" && q.Get("season") != "":
		writeJSON(w, scheduleTeamSeasonJSON)
	default:
		// Empty slate for unexpected queries — keep handlers from hard-failing.
		writeJSON(w, `{"dates":[]}`)
	}
}

func writeJSON(w http.ResponseWriter, body string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(body))
}
