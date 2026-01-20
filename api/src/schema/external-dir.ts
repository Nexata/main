// TODO: ExternalDir schema,
// with an id,
// an externalId varchar not null,
// credentialId: uuid().notNull().references(() => credential.id),
// a name/title varchar not null,
// a provider (filehost, enum from file.ts)
// url varchar
//  autosync bool default false
// metadata: jsonb() optional,
// createdAt default now
// modifiedAt default now
