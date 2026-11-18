import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, money, type Content } from './api';
import { Page } from './site';

const contentAccess: Record<string, string[]> = {
  'super-admin': ['causes','campaigns','stories','events','impact','reports','policies','partners','settings'],
  administrator: ['causes','campaigns','stories','events','impact','policies','partners','settings'],
  'finance-manager': ['reports'], 'campaign-manager': ['campaigns','causes'],
  'volunteer-coordinator': ['events'], 'content-manager': ['stories','impact','partners','settings','policies','causes'],
};
const labels: Record<string, string> = { overview: 'Overview', donations: 'Donations', causes: 'Causes and Programs', campaigns: 'Fundraising Campaigns',
  stories: 'News and Stories', events: 'Events', impact: 'Impact Metrics', reports: 'Financial Reports', policies: 'Legal Documents',
  partners: 'Partners', settings: 'Settings', volunteer: 'Volunteers', partner: 'Partnership Inquiries', contact: 'Contact Inquiries',
  newsletter: 'Newsletter Subscribers', event: 'Event Registrations', audit: 'Audit Logs' };
const fields = { title: 'Title', slug: 'Slug', summary: 'Summary', body: 'Body', image: 'Image URL (HTTPS)', link: 'Report or document URL (HTTPS)',
  cause: 'Related cause slug', goal: 'Goal in USD cents', value: 'Verified metric', unit: 'Unit', location: 'Location', organizer: 'Organizer', date: 'Event date (UTC)', deadline: 'Deadline (UTC)' };
type Row = Record<string, string | number | boolean | undefined>;
type AdminIdentity = { email: string; role: string };
type OverviewData = Record<string, number | undefined> & { finance?: { grossCents: number; netCents: number; donationCount: number; activeRecurring: number }; monthly?: { _id: string; netCents: number }[] };

export default function Admin() {
  const client = useQueryClient();
  const [error, setError] = useState('');
  const [section, setSection] = useState('overview');
  const identity = useQuery({ queryKey: ['admin-identity'], queryFn: () => api<AdminIdentity>('/auth/me'), retry: false });
  const user = identity.data;
  if (identity.isPending) return <Page title="Administration"><p role="status">Checking session…</p></Page>;
  if (!user) return <Page title="Administrator Sign In"><form className="form formPanel" onSubmit={async event => {
    event.preventDefault();
    setError('');
    try {
      await api('/auth/login', 'POST', Object.fromEntries(new FormData(event.currentTarget)));
      await client.invalidateQueries({ queryKey: ['admin-identity'] });
    } catch (failure) { setError((failure as Error).message); }
  }}><label>Email address<input type="email" autoComplete="username" name="email" required /></label>
    <label>Password<input type="password" autoComplete="current-password" name="password" required /></label>
    {error && <p role="alert">{error}</p>}<button className="button green">Sign in</button></form></Page>;

  const content = contentAccess[user.role] || [];
  const intake = ['super-admin','administrator'].includes(user.role) ? ['volunteer','partner','contact','newsletter','event'] : user.role === 'volunteer-coordinator' ? ['volunteer','event'] : [];
  const finance = ['super-admin','finance-manager'].includes(user.role);
  const items = ['overview', ...(finance ? ['donations'] : []), ...content, ...intake, ...(user.role === 'super-admin' ? ['audit'] : [])];
  const current = items.includes(section) ? section : 'overview';
  return <Page title="Administration"><div className="adminLayout"><aside aria-label="Dashboard sections">
    <p>{user.email}</p>{items.map(item => <button key={item} type="button" aria-current={current === item ? 'page' : undefined} className={'button ' + (current === item ? 'green' : 'subtle')} onClick={() => setSection(item)}>{labels[item]}</button>)}
    <button className="button subtle" onClick={async () => {
      try { await api('/auth/logout', 'POST', {}); client.removeQueries({ queryKey: ['admin'] }); client.setQueryData(['admin-identity'], null); setSection('overview'); }
      catch (failure) { setError((failure as Error).message); }
    }}>Sign out</button>{error && <p role="alert">{error}</p>}
  </aside><section className="adminPane" key={current}><h2>{labels[current]}</h2>
    {current === 'overview' ? <Overview /> : content.includes(current) ? <Editor kind={current} /> : <AdminTable kind={current} />}
  </section></div></Page>;
}

function Overview() {
  const query = useQuery({ queryKey: ['admin','overview'], queryFn: () => api<OverviewData>('/admin/overview'), retry: false });
  if (!query.data) return <p role="status">{query.isPending ? 'Loading…' : query.error?.message}</p>;
  const { finance, monthly, ...counts } = query.data;
  const entries: [string, string | number | undefined][] = [
    ['Active campaigns', counts.activeCampaigns], ['Completed campaigns', counts.completedCampaigns],
    ['Volunteer applications', counts.volunteerApplications], ['Upcoming events', counts.events], ['Partnership inquiries', counts.partnershipInquiries],
  ];
  if (finance) entries.push(['Verified test donations', finance.donationCount], ['Gross test donations', money(finance.grossCents)], ['Net test donations', money(finance.netCents)], ['Active test subscriptions', finance.activeRecurring]);
  return <><dl className="grid">{entries.filter(([,value]) => value !== undefined).map(([label, value]) => <div className="card cause" key={label}><dt>{label}</dt><dd className="metric">{value}</dd></div>)}</dl>
    {!!monthly?.length && <><h3 className="subsection">Monthly net test donations</h3><div aria-hidden="true" style={{ height: 240 }}><ResponsiveContainer><BarChart data={monthly.map(item => ({ month: item._id, amount: item.netCents / 100 }))}><XAxis dataKey="month" /><YAxis /><Tooltip /><Bar dataKey="amount" fill="#047857" isAnimationActive={false} /></BarChart></ResponsiveContainer></div>
      <table><thead><tr><th>Month</th><th>Net test donations</th></tr></thead><tbody>{monthly.map(item => <tr key={item._id}><td>{item._id}</td><td>{money(item.netCents)}</td></tr>)}</tbody></table></>}
  </>;
}

function Editor({ kind }: { kind: string }) {
  const client = useQueryClient();
  const path = '/admin/content/' + kind;
  const query = useQuery({ queryKey: ['admin',path], queryFn: () => api<Content[]>(path), retry: false });
  const [record, setRecord] = useState<Content | null>(null);
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const statuses = kind === 'campaigns' ? ['draft','active','completed','paused','archived'] : ['draft','published','archived', ...(kind === 'events' ? ['cancelled'] : [])];
  const shownFields = ['title','slug','summary','body','image',
    ...(kind === 'campaigns' ? ['cause','goal','deadline'] : []), ...(kind === 'events' ? ['date','location','organizer'] : []),
    ...(kind === 'impact' ? ['value','unit'] : []), ...(kind === 'reports' ? ['link'] : [])] as (keyof typeof fields)[];
  function select(item: Content | null) { setRecord(item); setRevision(value => value + 1); setPreview(null); setMessage(''); }
  return <>
    <div className="actions subsection"><button className="button subtle" onClick={() => select(null)}>New record</button>
      {query.data?.map(item => <button className="button subtle" key={item._id} onClick={() => select(item)}>{item.title} · {item.status}</button>)}</div>
    {query.error && <p role="alert">{query.error.message}</p>}
    <form key={revision} className="form formPanel subsection" onSubmit={async event => {
      event.preventDefault();
      const data: Record<string, unknown> = {};
      new FormData(event.currentTarget).forEach((value, key) => {
        if (value === '') return;
        data[key] = ['goal','value'].includes(key) ? Number(value) : ['date','deadline'].includes(key) ? new Date(value + 'Z').toISOString() : value;
      });
      const action = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
      if (action?.value === 'preview') { setPreview(data); return; }
      setPending(true);
      setMessage('');
      try {
        const saved = await api<Content>(path + '/' + encodeURIComponent(String(data.slug)), 'PUT', data);
        await client.invalidateQueries({ queryKey: ['admin',path] });
        select(saved);
        setMessage('Record saved.');
      } catch (failure) { setMessage((failure as Error).message); }
      finally { setPending(false); }
    }}>
      {shownFields.map(key => <label key={key}>{fields[key]}{['body','summary'].includes(key)
        ? <textarea name={key} rows={key === 'body' ? 6 : 3} defaultValue={record?.[key]} />
        : <input name={key} readOnly={key === 'slug' && !!record} required={['title','slug','goal'].includes(key)} type={['date','deadline'].includes(key) ? 'datetime-local' : ['goal','value'].includes(key) ? 'number' : 'text'} step={key === 'value' ? 'any' : undefined}
          defaultValue={['date','deadline'].includes(key) ? String(record?.[key] || '').slice(0,16) : record?.[key]} />}</label>)}
      <label>Status<select name="status" defaultValue={record?.status || 'draft'}>{statuses.map(status => <option key={status}>{status}</option>)}</select></label>
      <div className="actions"><button className="button subtle" value="preview" disabled={pending}>Preview</button><button className="button green" value="save" disabled={pending}>Save record</button></div>
      {message && <p role="status">{message}</p>}
    </form>
    {preview && <article className="card cause subsection"><p className="eyebrow">Preview</p><h3>{String(preview.title)}</h3><p>{String(preview.summary || '')}</p><p className="preserve">{String(preview.body || '')}</p></article>}
  </>;
}

const columns: Record<string, string[]> = {
  donations: ['reference','allocation','amount','refunded','disputed','verifiedAt'], audit: ['operation','target','createdAt'],
  volunteer: ['name','email','phone','location','interest','skills','availability','message','status'],
  partner: ['organization','name','email','phone','interest','message','status'],
  contact: ['name','email','phone','subject','message','status'], newsletter: ['email','createdAt'], event: ['name','email','eventNumber','status'],
};
function AdminTable({ kind }: { kind: string }) {
  const client = useQueryClient();
  const [error, setError] = useState('');
  const path = ['donations','audit'].includes(kind) ? '/admin/' + kind : '/admin/intake/' + kind;
  const query = useQuery({ queryKey: ['admin',path], queryFn: () => api<Row[]>(path), retry: false });
  if (!query.data) return <p role="status">{query.isPending ? 'Loading…' : query.error?.message}</p>;
  if (!query.data.length) return <p>No records.</p>;
  return <div className="tableWrap subsection">{error && <p role="alert">{error}</p>}<table><thead><tr>{columns[kind].map(field => <th scope="col" key={field}>{field.replace(/[A-Z]/g, letter => ' ' + letter.toLowerCase())}</th>)}</tr></thead>
    <tbody>{query.data.map(row => <tr key={String(row._id)}>{columns[kind].map(field => <td key={field}>{field === 'status'
      ? <select aria-label={'Status for ' + row.name} value={String(row.status)} onChange={async event => {
        try { setError(''); await api('/admin/intake/' + row._id, 'PATCH', { status: event.target.value }); await client.invalidateQueries({ queryKey: ['admin',path] }); }
        catch (failure) { setError((failure as Error).message); }
      }}>{['new','under-review','accepted','waitlisted','rejected','withdrawn'].map(status => <option key={status}>{status}</option>)}</select>
      : ['amount','refunded'].includes(field) ? money(Number(row[field]), String(row.currency || 'usd')) : String(row[field] ?? '')}</td>)}</tr>)}</tbody>
  </table></div>;
}
