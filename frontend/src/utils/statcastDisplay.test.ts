import { describe, expect, it } from 'vitest'
import {
  buildPitchZoneTooltipRows,
  buildScatterTooltipRows,
  buildSprayTooltipRows,
  formatStatcastEvent,
  lateralTowardBases,
  mapDistanceFromHomeFt,
  sprayPositionSummary,
} from './statcastDisplay'

describe('lateralTowardBases', () => {
  it('describes pull side', () => {
    expect(lateralTowardBases(200)).toMatch(/first-base/i)
    expect(lateralTowardBases(40)).toMatch(/third-base/i)
  })

  it('describes middle', () => {
    expect(lateralTowardBases(125)).toMatch(/middle/i)
  })
})

describe('mapDistanceFromHomeFt', () => {
  it('is zero at diagram plate center', () => {
    expect(mapDistanceFromHomeFt(125, 4)).toBe(0)
  })
})

describe('sprayPositionSummary', () => {
  it('combines distance and lateral', () => {
    const s = sprayPositionSummary(125, 404)
    expect(s).toMatch(/400/)
    expect(s).toMatch(/middle/i)
  })
})

describe('formatStatcastEvent', () => {
  it('maps common codes', () => {
    expect(formatStatcastEvent('home_run')).toBe('Home run')
    expect(formatStatcastEvent('field_out')).toBe('Out')
    expect(formatStatcastEvent('force_out')).toBe('Force out')
  })

  it('title-cases unknown snake_case', () => {
    expect(formatStatcastEvent('weird_event_code')).toBe('Weird Event Code')
  })
})

describe('buildSprayTooltipRows', () => {
  it('orders distance, velocity, angle, result', () => {
    const rows = buildSprayTooltipRows({
      playerName: 'A',
      fieldX: 125,
      fieldY: 200,
      launchSpeed: 100,
      launchAngle: 20,
      events: 'home_run',
    })
    expect(rows[0]).toEqual({ variant: 'title', text: 'A' })
    expect(rows[1]).toMatchObject({
      variant: 'step',
      step: 1,
      title: 'Distance',
      body: '196 ft',
    })
    expect(rows[2]).toMatchObject({ variant: 'step', step: 2, title: 'Velocity', body: '100.0 mph' })
    expect(rows[3]).toMatchObject({ variant: 'step', step: 3, title: 'Angle', body: '20°' })
    expect(rows[4]).toMatchObject({ variant: 'step', step: 4, title: 'Result', body: 'Home run' })
  })
})

describe('buildPitchZoneTooltipRows', () => {
  it('uses pitch name as title and a single velocity row', () => {
    const rows = buildPitchZoneTooltipRows({
      pitchName: 'Slider',
      releaseSpeed: 88.4,
    })
    expect(rows[0]).toEqual({ variant: 'title', text: 'Slider' })
    expect(rows[1]).toMatchObject({
      variant: 'step',
      step: 1,
      title: 'Velocity',
      body: '88.4 mph',
    })
  })

  it('falls back for missing pitch name and speed', () => {
    const rows = buildPitchZoneTooltipRows({})
    expect(rows[0]).toEqual({ variant: 'title', text: 'Unknown' })
    expect(rows[1]).toMatchObject({ title: 'Velocity', body: '—' })
  })

  it('combines pitch name and pitch type in the title when both differ', () => {
    const rows = buildPitchZoneTooltipRows({
      pitchName: '4-Seam Fastball',
      pitchType: 'FF',
    })
    expect(rows[0]).toEqual({ variant: 'title', text: '4-Seam Fastball (FF)' })
  })
})

describe('buildScatterTooltipRows', () => {
  it('matches spray metric order; field row points to spray chart', () => {
    const rows = buildScatterTooltipRows({
      playerName: 'B',
      launchSpeed: 95,
      launchAngle: 12,
      events: 'field_out',
    })
    expect(rows[1]).toMatchObject({ step: 1, title: 'On the field' })
    expect(rows[1].variant === 'step' && rows[1].body).toMatch(/spray chart/i)
    expect(rows[4]).toMatchObject({ step: 4, title: 'Result', body: 'Out' })
  })
})
