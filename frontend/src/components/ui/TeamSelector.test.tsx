import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Team } from '../../types/api'
import TeamSelector from './TeamSelector'

function team(partial: Partial<Team> & Pick<Team, 'id' | 'abbreviation' | 'teamName'>): Team {
  return {
    name: 'N',
    leagueId: 1,
    leagueName: 'AL',
    divisionId: 1,
    divisionName: 'E',
    active: true,
    ...partial,
  }
}

describe('TeamSelector', () => {
  const teams: Team[] = [
    team({ id: 2, abbreviation: 'ZZ', teamName: 'Zeds' }),
    team({ id: 1, abbreviation: 'AA', teamName: 'As' }),
  ]

  it('associates label with select via id and htmlFor', () => {
    render(
      <TeamSelector
        id="my-team"
        label="Pick club"
        teams={teams}
        value=""
        onChange={vi.fn()}
      />,
    )

    const label = screen.getByText('Pick club').closest('label')!
    const select = screen.getByRole('combobox', { name: 'Pick club' })
    expect(label).toHaveAttribute('for', 'my-team')
    expect(select).toHaveAttribute('id', 'my-team')
  })

  it('sorts options by abbreviation', () => {
    render(
      <TeamSelector teams={teams} value="" onChange={vi.fn()} />,
    )

    const select = screen.getByRole('combobox', { name: 'Team' })
    const options = within(select).getAllByRole('option')
    expect(options[0]).toHaveValue('')
    expect(options[1]?.textContent).toContain('AA')
    expect(options[2]?.textContent).toContain('ZZ')
  })

  it('calls onChange with numeric id or empty string', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<TeamSelector teams={teams} value="" onChange={onChange} />)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Team' }), '1')
    expect(onChange).toHaveBeenLastCalledWith(1)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Team' }), '')
    expect(onChange).toHaveBeenLastCalledWith('')
  })

  it('reflects controlled value', () => {
    render(
      <TeamSelector teams={teams} value={2} onChange={vi.fn()} />,
    )

    expect(screen.getByRole('combobox', { name: 'Team' })).toHaveValue('2')
  })
})
