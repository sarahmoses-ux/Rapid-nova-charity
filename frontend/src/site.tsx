import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { ChevronDown, Heart, HandHeart, Menu, ShieldCheck, Sparkles, X } from 'lucide-react';
import { domAnimation, LazyMotion, m, useReducedMotion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { api, money, useContent, type Content } from './api';
import { hero, volunteerPhoto, legal, proposed } from './brand';
import { Donate, DonationStatus, FormPage, IntakeForm } from './forms';

const Admin = lazy(() => import('./admin'));
const links = [
  ['Home', '/'], ['About Us', '/about'], ['Our Causes', '/causes'], ['Campaigns', '/campaigns'],
  ['Our Impact', '/impact'], ['Get Involved', '/get-involved'], ['News & Stories', '/stories'], ['Contact Us', '/contact'],
];
const dropdowns: Record<string, string[][]> = {
  '/about': [['Who We Are','/about'],['Our Mission','/about#mission'],['Our Team','/about#team'],['Transparency & Accountability','/transparency']],
  '/get-involved': [['Become a Volunteer','/volunteer'],['Become a Partner','/partners'],['Corporate Sponsorship','/partners/corporate'],['Fundraise With Us','/fundraise']],
};

function Brand() {
  return <Link className="brand" to="/"><span className="brandIcon"><Sparkles size={23} /></span><span>Rapid Nova<small>CHARITY</small></span></Link>;
}

function Header() {
  const [open, setOpen] = useState(false);
  const [dropdown, setDropdown] = useState('');
  const { pathname } = useLocation();
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api<{ announcement?: string }>('/settings/public'), retry: false });
  useEffect(() => { setOpen(false); setDropdown(''); }, [pathname]);
  return <header className="header" onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); setDropdown(''); } }}>
    {settings.data?.announcement && <div className="announcement">{settings.data.announcement}</div>}
    <div className="nav shell"><Brand />
      <button className="menu" aria-expanded={open} aria-controls="navigation" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
      <nav id="navigation" aria-label="Main navigation" className={open ? 'navlinks open' : 'navlinks'}>
        {links.map(([label, path]) => <div className="navitem" key={path}><NavLink onClick={() => { setOpen(false); setDropdown(''); }} end={path === '/'} to={path}>{label}</NavLink>
          {dropdowns[path] && <><button className="dropdownToggle" aria-label={label + ' links'} aria-expanded={dropdown === path} onClick={() => setDropdown(dropdown === path ? '' : path)}><ChevronDown size={13} /></button>
            {dropdown === path && <div className="submenu">{dropdowns[path].map(([name, target]) => <Link key={target} to={target} onClick={() => { setOpen(false); setDropdown(''); }}>{name}</Link>)}</div>}</>}
        </div>)}
        <Link className="button green" to="/donate" onClick={() => setOpen(false)}><Heart size={17} /> Donate Now</Link>
      </nav>
    </div>
  </header>;
}

function Footer() {
  return <footer><div className="shell footerGrid"><div><Brand /><p>Creating opportunities and strengthening communities with compassion and accountability.</p></div>
    <div><h2>Explore</h2><Link to="/about">About Us</Link><Link to="/causes">Our Causes</Link><Link to="/campaigns">Campaigns</Link><Link to="/stories">News & Stories</Link></div>
    <div><h2>Get involved</h2><Link to="/donate">Donate Now</Link><Link to="/volunteer">Volunteer</Link><Link to="/partners">Partner With Us</Link><Link to="/events">Events</Link><Link to="/contact">Contact Us</Link></div>
    <div><h2>Accountability</h2><Link to="/transparency">Financial Transparency</Link>{Object.entries(legal).map(([slug, title]) => <Link key={slug} to={'/policies/' + slug}>{title}</Link>)}</div>
  </div><div className="shell footnote"><span>© {new Date().getFullYear()} Rapid Nova Charity</span><Link to="/newsletter/unsubscribe">Newsletter preferences</Link></div></footer>;
}

export function Page({ title, intro, children }: { title: string; intro?: string; children?: React.ReactNode }) {
  return <><div className="pageHead"><div className="shell"><h1>{title}</h1>{intro && <p>{intro}</p>}</div></div><div className="shell section">{children}</div></>;
}

function CausePhoto({ photo, lazy = false }: { photo: NonNullable<(typeof proposed)[number]['photo']>; lazy?: boolean }) {
  return <figure className="causePhoto">
    <img src={photo.src} alt={photo.alt} loading={lazy ? 'lazy' : 'eager'} decoding="async" />
    <figcaption>Illustrative photo by <a href={photo.source}>{photo.credit} / Unsplash</a></figcaption>
  </figure>;
}

function ProposedCards() {
  return <div className="grid">{proposed.map(({ icon: Icon, ...cause }) => <article className="causeCard card" key={cause.slug}>
    {cause.photo && <CausePhoto photo={cause.photo} lazy />}
    <div className="cause"><span className="causeIcon"><Icon size={24} /></span><h3>{cause.title}</h3><p>{cause.summary}</p><Link className="textlink" to={'/causes/' + cause.slug}>Explore this cause</Link></div>
  </article>)}</div>;
}

function RecordCard({ item, type }: { item: Content; type: string }) {
  const name = type === 'impact' || type === 'reports' ? item.title : <Link to={'/' + type + '/' + item.slug}>{item.title}</Link>;
  return <article className="card record">{item.image && <img src={item.image} alt="" loading="lazy" />}<div>
    <h3>{name}</h3><p>{item.summary}</p>
    {type === 'impact' && item.value !== undefined && <strong className="metric">{item.value.toLocaleString()} {item.unit}</strong>}
    {type === 'reports' && item.link && <a className="textlink" href={item.link}>Open report</a>}
    {type === 'campaigns' && <><Progress item={item} />{item.status === 'active' && <Link className="button green" to={'/donate?campaign=' + item.slug}>Donate</Link>}</>}
  </div></article>;
}
function Progress({ item }: { item: Content }) {
  if (!item.goal) return null;
  const percent = Math.floor(100 * (item.raised || 0) / item.goal);
  return <div className="progress"><div><strong>{money(item.raised || 0, item.currency)} in test donations</strong><span>{percent}%</span></div>
    <progress aria-label="Test donation progress" value={Math.min(100, percent)} max={100} /><p>Goal {money(item.goal, item.currency)}{item.deadline && ' · ' + item.deadline.slice(0, 10)}</p></div>;
}

function Home() {
  const reduce = useReducedMotion();
  const campaigns = useContent('/campaigns?status=active');
  const stories = useContent('/stories');
  const impact = useContent('/impact');
  const partners = useContent('/partners');
  return <>
    <section className="hero" style={{ backgroundImage: 'linear-gradient(90deg,#102a43 8%,#102a43ee 34%,#102a4377 61%,#102a431a),url(' + hero + ')' }}>
      <div className="shell heroInner"><LazyMotion features={domAnimation}><m.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
        <p className="eyebrow"><span /> Community-led change</p>
        <h1>Together, we can<br /> <em>change lives.</em></h1>
        <p className="heroCopy">Rapid Nova Charity is dedicated to creating meaningful opportunities, strengthening communities and bringing hope to those who need it most.</p>
        <div className="actions"><Link className="button gold" to="/donate"><Heart size={18} /> Donate Now</Link><Link className="button outline" to="/about#mission">Discover Our Mission</Link></div>
      </m.div></LazyMotion><small className="credit">Illustrative photo by Joel Muniz / Unsplash</small></div>
    </section>
    <div className="values"><div className="shell"><span><HandHeart /> Community-led development</span><span><ShieldCheck /> Financial accountability</span><span><Heart /> Dignity and compassion</span></div></div>
    <section className="section shell split"><div><p className="eyebrow">Our mission</p><h2>Opportunity begins<br /> with community.</h2></div><div><p className="intro">We believe people should have a say in the decisions that shape their lives. Our mission is to work alongside communities to expand access to essential services and build opportunities that last.</p><Link className="textlink" to="/about">Get to know Rapid Nova Charity</Link></div></section>
    {!!impact.data?.length && <section className="section light"><div className="shell"><h2>Verified impact</h2><div className="grid">{impact.data.map(item => <RecordCard key={item._id} item={item} type="impact" />)}</div></div></section>}
    <section className="section light"><div className="shell"><div className="sectionHeading"><div><p className="eyebrow">Proposed causes</p><h2>Where we hope to help</h2></div><Link className="textlink" to="/causes">Explore all causes</Link></div><ProposedCards /></div></section>
    <section className="section shell"><div className="sectionHeading"><h2>Fundraising campaigns</h2><Link className="textlink" to="/campaigns">View campaigns</Link></div><Records query={campaigns} type="campaigns" empty="There are no active campaigns published." limit={3} /></section>
    <section className="section light"><div className="shell feature"><figure><img src={volunteerPhoto} loading="lazy" alt="Volunteers wearing gloves pack food into bags" /><figcaption>Illustrative photo by Joel Muniz / Unsplash</figcaption></figure><div><p className="eyebrow">Make time for others</p><h2>Bring your skills.<br /> Give your time.</h2><p>Tell us how you’d like to contribute, from bringing professional experience to supporting local outreach.</p><Link className="button green" to="/volunteer">Become a Volunteer</Link></div></div></section>
    <section className="section shell split"><div><h2>How your gift can help</h2><p>Explore one-time and monthly giving options.</p></div><div className="amountLinks">{[25,50,100,250].map(amount => <Link className="button subtle" to={'/donate?amount=' + amount} key={amount}>${amount}</Link>)}<Link className="button green" to="/donate">Custom amount</Link></div></section>
    {!!partners.data?.length && <section className="section shell"><h2>Partners and sponsors</h2><div className="grid">{partners.data.map(item => <article key={item._id} className="card cause"><h3>{item.title}</h3><p>{item.summary}</p></article>)}</div></section>}
    <section className="section light"><div className="shell"><div className="sectionHeading"><h2>Latest news & stories</h2><Link className="textlink" to="/stories">View all stories</Link></div><Records query={stories} type="stories" empty="There are no published stories yet." limit={3} /></div></section>
    <section className="section shell split"><div><p className="eyebrow">Transparency</p><h2>Accountability<br /> matters.</h2></div><div><p className="intro">Our transparency page brings together approved information about governance, finances and impact as it becomes available.</p><Link className="textlink" to="/transparency">Explore transparency and reports</Link></div></section>
    <section className="newsletter"><div className="shell split"><div><h2>Stay in touch</h2><p>Sign up for news, outreach updates and ways to get involved.</p></div><IntakeForm kind="newsletter" /></div></section>
    <section className="closing section"><div className="shell"><h2>Small acts. Extraordinary impact.</h2><div className="actions"><Link className="button gold" to="/donate">Donate Now</Link><Link className="button outline" to="/volunteer">Become a Volunteer</Link><Link className="button outline" to="/partners">Partner With Us</Link></div></div></section>
  </>;
}

function Records({ query, type, empty, limit }: { query: ReturnType<typeof useContent>; type: string; empty: string; limit?: number }) {
  if (query.isPending) return <p role="status">Loading…</p>;
  if (query.isError) return <p role="status">Updates are temporarily unavailable.</p>;
  return query.data.length ? <div className="grid">{query.data.slice(0, limit).map(item => <RecordCard key={item._id} item={item} type={type} />)}</div> : <p>{empty}</p>;
}

const contentTitles: Record<string, string> = { causes: 'Our Causes', campaigns: 'Fundraising Campaigns', stories: 'News & Stories', events: 'Community Events', impact: 'Our Impact', reports: 'Transparency & Accountability' };

function Collection({ type }: { type: string }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('recent');
  const [cause, setCause] = useState('');
  const causes = useContent('/causes');
  const query = useContent('/' + type + '?' + new URLSearchParams({ search, status, sort, cause }));
  return <Page title={contentTitles[type]} intro={type === 'reports' ? 'Find verified financial and governance documents as they become available.' : undefined}>
    {['campaigns','stories'].includes(type) && <div className="filters"><label>Search<input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>
      {type === 'campaigns' && <><label>Cause<select value={cause} onChange={event => setCause(event.target.value)}><option value="">All causes</option>{causes.data?.map(item => <option key={item._id} value={item.slug}>{item.title}</option>)}</select></label><label>Status<select value={status} onChange={event => setStatus(event.target.value)}><option value="">All published</option><option value="active">Active</option><option value="completed">Completed</option></select></label>
      <label>Sort by<select value={sort} onChange={event => setSort(event.target.value)}><option value="recent">Most recent</option><option value="progress">Fundraising progress</option></select></label></>}</div>}
    <Records query={query} type={type} empty="No published records match this view." />
    {type === 'causes' && <div className="subsection"><h2>Proposed causes</h2><p>These areas are under consideration.</p><ProposedCards /></div>}
    {type === 'impact' && <Link className="textlink" to="/transparency">Find impact reports</Link>}
  </Page>;
}

function Detail({ type }: { type: string }) {
  const { slug } = useParams();
  const query = useQuery({ queryKey: [type, slug], queryFn: () => api<Content>('/' + type + '/' + encodeURIComponent(slug || '')), retry: false });
  const proposal = type === 'causes' && proposed.find(item => item.slug === slug);
  if (!query.data && proposal) return <Page title={proposal.title} intro={proposal.summary}><div className="prose">{proposal.photo && <CausePhoto photo={proposal.photo} />}<p>Proposed cause under consideration.</p><Link className="button green" to="/volunteer">Express volunteer interest</Link></div></Page>;
  if (query.isPending) return <Page title="Loading…" />;
  if (!query.data) return <Page title="Content unavailable"><Link to={'/' + type}>Back to {contentTitles[type]}</Link></Page>;
  const item = query.data;
  return <Page title={item.title} intro={item.summary}><article className="prose">
    {item.image && <img className="detailImage" src={item.image} alt="" />}{item.body && <p className="preserve">{item.body}</p>}
    {type === 'campaigns' && <><Progress item={item} />{item.status === 'active' && <Link className="button green" to={'/donate?campaign=' + item.slug}>Donate now</Link>}</>}
    {type === 'causes' && <div className="actions"><Link className="button green" to={'/donate?cause=' + item.slug}>Support this cause</Link><Link className="button subtle" to="/volunteer">Volunteer</Link></div>}
    {type === 'events' && <><p>{[item.date && new Date(item.date).toLocaleString(), item.location, item.organizer].filter(Boolean).join(' · ')}</p>{item.date && new Date(item.date) > new Date() && <IntakeForm kind="event" eventId={item._id} />}</>}
    {(type === 'stories' || type === 'campaigns') && <a className="textlink share" href={'mailto:?subject=' + encodeURIComponent(item.title) + '&body=' + encodeURIComponent(window.location.href)}>Share by email</a>}
  </article></Page>;
}

function Policy() {
  const { slug } = useParams();
  const key = slug as keyof typeof legal;
  const query = useQuery({ queryKey: ['policy', key], queryFn: () => api<Content>('/policies/' + encodeURIComponent(key)), retry: false, enabled: !!legal[key] });
  if (!legal[key]) return <Page title="Page unavailable" />;
  return <Page title={legal[key]}>{query.data ? <p className="prose preserve">{query.data.body}</p> : <p>{query.isPending ? 'Loading…' : 'Draft policy pending qualified review and approval.'}</p>}</Page>;
}

function LocationEffects() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const segment = pathname.split('/').filter(Boolean).at(-1);
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]') || document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = window.location.origin + pathname;
    document.head.append(canonical);
    document.title = segment ? segment.replaceAll('-', ' ').replace(/^./, letter => letter.toUpperCase()) + ' | Rapid Nova Charity' : 'Rapid Nova Charity';
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', document.title);
    const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]') || document.createElement('meta');
    robots.name = 'robots';
    robots.content = ['/admin','/donate/status','/newsletter/unsubscribe'].includes(pathname) ? 'noindex, nofollow' : 'index, follow';
    document.head.append(robots);
    if (hash) requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView());
    else window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export function App() {
  return <><LocationEffects /><a className="skip" href="#main">Skip to content</a><Header /><main id="main" tabIndex={-1}>
    <Routes>
      <Route index element={<Home />} />
      <Route path="/about" element={<Page title="About Rapid Nova Charity" intro="A mission rooted in compassion, dignity and community-led development."><div className="prose"><h2 id="mission">Our mission</h2><p>To work alongside communities to expand access to essential services and create opportunities that last.</p><h2>Our vision</h2><p>Communities where everyone can shape a safe, healthy and fulfilling future.</p><h2>Our values</h2><p>Compassion, integrity, accountability, equality, service and sustainability.</p><h2 id="team">Leadership and governance</h2><p>Leadership and registration details are pending confirmation.</p><Link className="textlink" to="/transparency">Transparency & Accountability</Link></div></Page>} />
      {['causes','campaigns','stories','events','impact'].map(type => <Route key={type} path={'/' + type} element={<Collection key={type} type={type} />} />)}
      {['causes','campaigns','stories','events'].map(type => <Route key={type} path={'/' + type + '/:slug'} element={<Detail type={type} />} />)}
      <Route path="/transparency" element={<Collection type="reports" />} />
      <Route path="/policies/:slug" element={<Policy />} />
      <Route path="/get-involved" element={<Page title="Get Involved"><div className="grid">{dropdowns['/get-involved'].map(([name, target]) => <Link className="card cause textlink" key={target} to={target}>{name}</Link>)}<Link className="card cause textlink" to="/events">Community Events</Link></div></Page>} />
      <Route path="/volunteer" element={<FormPage kind="volunteer" title="Become a Volunteer" intro="Tell us about your availability and interests. Confirmed roles may require orientation and safeguarding checks." />} />
      <Route path="/partners" element={<FormPage kind="partner" title="Partner With Us" intro="Discuss corporate, individual, institutional or community partnerships." />} />
      <Route path="/partners/corporate" element={<FormPage kind="partner" title="Corporate Sponsorship" />} />
      <Route path="/fundraise" element={<FormPage kind="partner" title="Fundraise With Us" intro="Tell us about your fundraising idea and preferred timeline." />} />
      <Route path="/contact" element={<FormPage kind="contact" title="Contact Us" intro="Use this form to get in touch. Office and telephone details are pending confirmation." />} />
      <Route path="/newsletter/unsubscribe" element={<FormPage kind="unsubscribe" title="Unsubscribe from newsletter" />} />
      <Route path="/donate" element={<Donate />} /><Route path="/donate/status" element={<DonationStatus />} />
      <Route path="/admin" element={<Suspense fallback={<Page title="Loading administration…" />}><Admin /></Suspense>} />
      <Route path="*" element={<Page title="Page unavailable"><Link className="textlink" to="/">Return home</Link></Page>} />
    </Routes>
  </main><Footer /></>;
}
