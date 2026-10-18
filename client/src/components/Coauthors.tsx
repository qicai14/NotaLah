import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import type { CollabPerson } from '../types';

/** "with Ana, Ben and Chloe": credit for edit collaborators who have saved a change (R30, wireframe 16). Nothing when there are none. */
export function Coauthors({ people }: { people?: CollabPerson[] }) {
  if (!people?.length) return null;
  return (
    <span className="text-muted-foreground">
      with{' '}
      {people.map((p, i) => (
        <Fragment key={p.id}>
          {i > 0 && (i === people.length - 1 ? ' and ' : ', ')}
          <Link to={`/users/${p.id}`} className="font-semibold text-foreground hover:underline">
            {p.displayName}
          </Link>
        </Fragment>
      ))}
    </span>
  );
}
