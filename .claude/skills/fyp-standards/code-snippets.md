# Code snippet rules (Ch 5.2)

- Exactly **3** of the most complex **backend** functions. No HTML/JSX. Good candidates here:
  the ranking score computation, the relevance/interest-vector update, and message-request
  approval or post-anchored messaging over Socket.io.
- Proper indentation, lowercase variable names.
- SQL keywords UPPERCASE (`SELECT`, `FROM`, `WHERE`, `GROUP BY`, `ORDER BY`), column names
  lowercase, table names as in the schema (`"POST_T"`).

## Programmer profiler header

Every snippet starts with this header, adapted to `/* */` comments for TypeScript:

```
/******************************************************************
* Student Programmer: Mr Lim Qi Cai
* Position: Student Programmer
* Program Name: <filename.ts>
* Description: <1-3 lines on what the function does>
* Date Created: <date> | Date Modified: <date>
******************************************************************/
```

Add this header to the real source file of the three chosen functions too, so the snippet in
the report and the submitted code match.
