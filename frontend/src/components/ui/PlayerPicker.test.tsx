import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchPlayersSearch } from '../../api/client'
import type { PlayersSearchResponse } from '../../types/api.compat'
import type { PlayerPick } from './PlayerPicker'
import PlayerPicker from './PlayerPicker'

function PlayerPickerHarness(props: {
  initial?: PlayerPick | null
  disabled?: boolean
}) {
  const [selected, setSelected] = useState<PlayerPick | null>(
    props.initial ?? null,
  )
  return (
    <PlayerPicker
      label="Player"
      selected={selected}
      onChange={setSelected}
      disabled={props.disabled}
    />
  )
}

vi.mock('../../api/client', () => ({
  fetchPlayersSearch: vi.fn(),
}))

/** Debounced search waits 320ms before calling the API */
async function flushSearchDebounce() {
  await new Promise((r) => setTimeout(r, 400))
}

describe('PlayerPicker', () => {
  beforeEach(() => {
    vi.mocked(fetchPlayersSearch).mockReset()
  })

  it('associates search input with aria-controls for the results list', async () => {
    const user = userEvent.setup()
    vi.mocked(fetchPlayersSearch).mockResolvedValue({
      query: 'Pl',
      people: [{ id: 1, fullName: 'A Player', active: true }],
    } satisfies PlayersSearchResponse)

    render(
      <PlayerPicker
        label="Player A"
        selected={null}
        onChange={vi.fn()}
      />,
    )

    const input = screen.getByRole('searchbox')
    const listId = input.getAttribute('aria-controls')
    expect(listId).toBeTruthy()

    await user.type(input, 'Pl')
    await flushSearchDebounce()

    await waitFor(() => {
      expect(fetchPlayersSearch).toHaveBeenCalledWith(
        { names: 'Pl' },
        expect.any(AbortSignal),
      )
    })

    const list = document.getElementById(listId!)
    expect(list).toHaveAttribute('role', 'listbox')
  })

  it('does not search until at least two characters', async () => {
    const user = userEvent.setup()

    render(
      <PlayerPicker label="B" selected={null} onChange={vi.fn()} />,
    )

    await user.type(screen.getByRole('searchbox'), 'J')
    await flushSearchDebounce()

    expect(fetchPlayersSearch).not.toHaveBeenCalled()
  })

  it('shows role=alert when search fails', async () => {
    const user = userEvent.setup()
    vi.mocked(fetchPlayersSearch).mockRejectedValue(new Error('network'))

    render(
      <PlayerPicker label="C" selected={null} onChange={vi.fn()} />,
    )

    await user.type(screen.getByRole('searchbox'), 'Jo')
    await flushSearchDebounce()

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('network')
    })
  })

  it('shows No matches when API returns empty people', async () => {
    const user = userEvent.setup()
    vi.mocked(fetchPlayersSearch).mockResolvedValue({ query: 'Xx', people: [] })

    render(
      <PlayerPicker label="D" selected={null} onChange={vi.fn()} />,
    )

    await user.type(screen.getByRole('searchbox'), 'Xx')
    await flushSearchDebounce()

    await waitFor(() => {
      expect(screen.getByText('No matches.')).toBeInTheDocument()
    })
  })

  it('selecting a hit updates selection and shows Change control', async () => {
    const user = userEvent.setup()
    vi.mocked(fetchPlayersSearch).mockResolvedValue({
      query: 'Oh',
      people: [
        {
          id: 660271,
          fullName: 'Shohei Ohtani',
          position: 'DH',
          active: true,
          primaryNumber: '17',
        },
      ],
    } satisfies PlayersSearchResponse)

    render(<PlayerPickerHarness />)

    await user.type(screen.getByRole('searchbox'), 'Oh')
    await flushSearchDebounce()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Shohei Ohtani/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Shohei Ohtani/i }))

    expect(screen.getByText('Shohei Ohtani')).toBeInTheDocument()
    expect(screen.getByText(/ID 660271/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument()
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  })

  it('disables Change when disabled', () => {
    render(
      <PlayerPickerHarness
        initial={{ id: 1, fullName: 'Only' }}
        disabled
      />,
    )

    expect(screen.getByRole('button', { name: 'Change' })).toBeDisabled()
  })
})
