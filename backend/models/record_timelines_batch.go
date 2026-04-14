package models

// RecordTimelinesBatchResponse is GET /record-timelines/batch.
type RecordTimelinesBatchResponse struct {
	Season    int                      `json:"season"`
	Timelines []RecordTimelineResponse `json:"timelines"`
}
