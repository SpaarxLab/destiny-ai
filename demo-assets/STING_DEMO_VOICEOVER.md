# STING — 2:54 judge-first demo

Read at a calm, conversational pace. The locked visual cut is 2 minutes 54 seconds, leaving six seconds under the challenge limit.

| Time | Visual | Voiceover |
| --- | --- | --- |
| 0:00–0:10 | Live door: “An AI thinks it knows what you want. Prove it wrong.” | “Your AI says it knows you. STING makes it prove it—before you give it the answer.” |
| 0:10–0:25 | Door, then the eight lives | “STING is a three-minute, no-typing-required game for a person and their agent. The agent casts eight possible lives from what it knows. You tap the ones that sting.” |
| 0:25–0:43 | Cast and tool badge | “This is not an AI quiz. The page gives the agent structured WebMCP tools, but only the move this phase permits. First it may inspect and cast. After a mandatory cold read, it may bet or ask once. The person still owns every tap.” |
| 0:43–1:05 | Sealed duel | “Here is the key move. Before I choose, the agent calls `stage_duel` and seals a chip-staked bet on which side I will pick. The page hashes that commitment. It cannot see my tap or rewrite the bet afterward.” |
| 1:05–1:27 | Miss, then correction screenshot | “I choose the other side. It loses two chips. Now the browser changes what the agent may do: `stage_duel` disappears. It cannot bet again until it makes a specific public correction about what it misread.” |
| 1:27–1:47 | Tool catalogue / correction | “That is WebMCP doing product work, not sitting beside the product. The catalogue is the trust meter. A miss changes the agent’s actual capabilities, not just the colour of a button.” |
| 1:47–2:08 | Verdict / card | “After enough earned evidence, STING gives a provisional read: what I kept choosing, the tension I have not settled, and what I may be underrating. I can kill a wrong line, and that exact claim cannot return.” |
| 2:08–2:28 | Dare and card | “Then it turns the read into one bounded test this week, with a clear done looks like. A sealed letter is withheld until the due date, so reality settles the next bet. The result is not advice. It is a record of what survived contact with my choices.” |
| 2:28–2:42 | Field brief | “Finally, STING writes a field brief for any future AI: treat this as revisable evidence, name the tradeoff, make a bet, and admit what you misread. Less performance. More proof.” |
| 2:42–2:54 | End slate | “STING. Your AI says it knows you. Prove it wrong.” |

This table is the canonical spoken script for `STING_DEMO_NARRATED.mp4`. The exact generated-audio transcript is in `STING_DEMO_SYNTHETIC_NARRATION.txt`, and the matching upload captions are `STING_DEMO_NARRATED.srt`.

## Live demo beats to capture if possible

1. Start inside ChatGPT’s in-app browser and say: “play STING with me.”
2. Show the page’s first `inspect_room` tool, then click **Play**.
3. Let the agent call `stage_cast`; pause on the eight lives.
4. Call `stage_duel`; hold on the commitment before the person taps.
5. Choose the opposite option; show the missing `stage_duel` tool.
6. Call `propose_hypothesis` with `kind: revision`; refresh the tool list.
7. Cut to the card and field brief. Do not try to film a full match in one take.

## Submission-safe claims

- Say “the tool catalogue changes” only while showing the Chrome/ChatGPT tool view or the verified test screen.
- Say “the house completes the game if no agent is available,” not “Spark always works.”
- Say “the public demo is live on Vercel and verified in the in-app browser.” Do not claim origin-trial coverage until the production token is installed and checked.
