import { X } from 'lucide-react';
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { RankingComponents } from '../../types';

const ROWS: { key: keyof RankingComponents; name: string; explain: string }[] = [
  { key: 'E', name: 'Engagement', explain: 'Likes and comments; a comment counts for more than a like.' },
  { key: 'R', name: 'Recency', explain: 'Newer notes score higher, fading over a few days.' },
  { key: 'V', name: 'Lecturer validation', explain: 'Full marks once an approved lecturer Super Likes it.' },
  { key: 'M', name: 'Hashtag match', explain: 'How closely its hashtags match the notes you engage with.' },
];

/** "Why this note?" (FR3, wireframe 12): the four ranking scores and the total for the note on screen. */
export function WhyThisNote({
  score,
  components,
  guest,
  className,
}: {
  score: number;
  components: RankingComponents;
  guest: boolean;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          'h-8 cursor-pointer rounded-full bg-background/85 px-3 text-caption font-bold text-foreground backdrop-blur-md transition-colors hover:bg-background data-[state=open]:ring-2 data-[state=open]:ring-foreground',
          className,
        )}
      >
        <span className="md:hidden">Why?</span>
        <span className="max-md:hidden">Why this note?</span>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(22rem,calc(100vw-2rem))] rounded-xl border p-5 shadow-(--shadow-float)"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-title-sm font-bold">Why you&rsquo;re seeing this note</h3>
          <PopoverClose
            aria-label="Close"
            className="-mt-1.5 -mr-2 grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </PopoverClose>
        </div>
        <p className="mt-1 text-body-sm text-muted-foreground">
          The feed ranks notes with four scores from 0 to 1, weighted and added up. No AI is involved.
        </p>
        <dl className="mt-4 flex flex-col gap-3.5">
          {ROWS.map(({ key, name, explain }) => {
            const v = components[key];
            return (
              <div key={key}>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-body-sm font-semibold">
                    {name} ({key})
                  </dt>
                  <dd className="text-body-sm font-bold tabular-nums">{v.toFixed(2)}</dd>
                </div>
                <div
                  role="meter"
                  aria-label={`${name} score`}
                  aria-valuemin={0}
                  aria-valuemax={1}
                  aria-valuenow={Number(v.toFixed(2))}
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-strong"
                >
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-(--duration-slow) ease-(--ease-out-soft)"
                    style={{ width: `${Math.round(Math.min(1, Math.max(0, v)) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-caption text-muted-foreground">
                  {key === 'M' && guest ? 'Guests have no history, so this is 0.' : explain}
                </p>
              </div>
            );
          })}
        </dl>
        <div className="mt-4 flex items-center justify-between rounded-md bg-surface px-4 py-3">
          <span className="text-body-sm font-semibold">Score</span>
          <span className="text-title font-bold tabular-nums">{score.toFixed(2)}</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
