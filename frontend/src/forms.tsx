import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { api, money, useContent } from './api';
import { Page } from './site';

type Kind = 'volunteer' | 'partner' | 'contact' | 'newsletter' | 'unsubscribe' | 'event';
type Field = [string, string, string?];
const name: Field = ['name', 'Full name'];
const email: Field = ['email', 'Email address', 'email'];
const phone: Field = ['phone', 'Phone number (optional)', 'tel'];
const forms: Record<Kind, { path: string; button: string; fields: Field[]; consent?: string }> = {
  volunteer: { path: '/volunteers/apply', button: 'Submit application', fields: [name, email, phone, ['location','General location'],['interest','Area of interest'],['skills','Relevant skills','textarea'],['availability','Availability'],['message','Why would you like to volunteer?','textarea']], consent: 'I agree to be contacted about this application.' },
  partner: { path: '/partnerships/inquire', button: 'Send inquiry', fields: [['organization','Organization name'],name,['email','Work email','email'],phone,['interest','Partnership type'],['message','Tell us about your proposal','textarea']] },
  contact: { path: '/contact', button: 'Send message', fields: [name,email,phone,['subject','Subject'],['message','Message','textarea']] },
  newsletter: { path: '/newsletter/subscribe', button: 'Subscribe', fields: [email], consent: 'I agree to receive newsletter emails.' },
  unsubscribe: { path: '/newsletter/unsubscribe', button: 'Unsubscribe', fields: [] },
  event: { path: '/events', button: 'Register', fields: [name,email], consent: 'I agree to be contacted about this event.' },
};

export function IntakeForm({ kind, eventId }: { kind: Kind; eventId?: string }) {
  const config = forms[kind];
  const [params] = useSearchParams();
  const token = params.get('token');
  const [success, setSuccess] = useState('');
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<Record<string, string | boolean>>();
  return <form className="form" onSubmit={handleSubmit(async data => {
    setSuccess('');
    try {
      await api(kind === 'event' ? '/events/' + eventId + '/register' : config.path, 'POST', kind === 'unsubscribe' ? { token } : data);
      setSuccess(kind === 'unsubscribe' ? 'Your subscription has been removed.' : 'Your submission has been received.');
      reset();
    } catch (error) { setError('root', { message: (error as Error).message }); }
  })}>
    {kind === 'unsubscribe' && !token && <p>Use the unsubscribe link provided with your newsletter email.</p>}
    {config.fields.map(([key,label,type]) => <label key={key}>{label}{type === 'textarea'
      ? <textarea rows={4} maxLength={4000} {...register(key, { required: true })} required />
      : <input type={type || 'text'} maxLength={200} {...register(key, { required: key !== 'phone' })} required={key !== 'phone'} />}</label>)}
    {config.consent && <label className="check"><input type="checkbox" {...register('consent', { required: true })} required />{config.consent}</label>}
    {errors.root && <p role="alert">{errors.root.message}</p>}
    {success && <p role="status">{success}</p>}
    <button className="button green" disabled={isSubmitting || (kind === 'unsubscribe' && !token)}>{isSubmitting ? 'Submitting…' : config.button}</button>
  </form>;
}

export function FormPage({ kind, title, intro }: { kind: Kind; title: string; intro?: string }) {
  return <Page title={title} intro={intro}><div className="formPanel"><IntakeForm key={kind} kind={kind} /></div></Page>;
}

const amountPattern = z.string().regex(/^\d{1,5}(\.\d{1,2})?$/);
type Gift = { amount: string; frequency: 'once' | 'monthly'; allocation: string; name: string; email: string; phone: string; dedication: string; anonymous: boolean; consent: boolean };

export function Donate() {
  const [params] = useSearchParams();
  const campaigns = useContent('/campaigns?status=active');
  const causes = useContent('/causes');
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api<{ checkoutEnabled: boolean }>('/settings/public'), retry: false });
  const selected = params.get('campaign') ? 'campaign:' + params.get('campaign') : params.get('cause') ? 'cause:' + params.get('cause') : 'general';
  const { register, watch, setValue, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<Gift>({ defaultValues: { amount: params.get('amount') || '50', frequency: 'once', allocation: selected } });
  return <Page title="Make a Donation" intro="Choose a one-time or monthly gift. This preview supports Stripe test checkout when configured.">
    <div className="formPanel"><form className="form" onSubmit={handleSubmit(async values => {
      const parsed = amountPattern.safeParse(values.amount);
      const cents = Math.round(Number(values.amount) * 100);
      if (!parsed.success || cents < 100 || cents > 1000000) return setError('amount', { message: 'Enter a gift from $1 to $10,000 with up to two decimal places.' });
      try {
        const result = await api<{ url: string }>('/donations/checkout', 'POST', { ...values, amount: cents });
        window.location.assign(result.url);
      } catch (error) { setError('root', { message: (error as Error).message }); }
    })}>
      <fieldset><legend>Giving frequency</legend><div className="actions"><label className="check"><input type="radio" value="once" {...register('frequency')} /> One-time</label><label className="check"><input type="radio" value="monthly" {...register('frequency')} /> Monthly</label></div></fieldset>
      <fieldset><legend>Suggested amounts</legend><div className="amountLinks">{[10,25,50,100,250,500].map(value => <button className={'button ' + (watch('amount') === String(value) ? 'green' : 'subtle')} aria-pressed={watch('amount') === String(value)} type="button" key={value} onClick={() => setValue('amount', String(value))}>{money(value * 100)}</button>)}</div></fieldset>
      <label>Amount in USD<input inputMode="decimal" aria-invalid={!!errors.amount} {...register('amount')} required />{errors.amount && <span role="alert">{errors.amount.message}</span>}</label>
      <label>Direct your gift<select {...register('allocation')}><option value="general">General charity fund</option>
        {selected !== 'general' && ![...(causes.data || []).map(item => 'cause:' + item.slug), ...(campaigns.data || []).map(item => 'campaign:' + item.slug)].includes(selected) && <option value={selected}>Requested designation</option>}
        {causes.data?.map(item => <option key={item._id} value={'cause:' + item.slug}>{item.title}</option>)}
        {campaigns.data?.map(item => <option key={item._id} value={'campaign:' + item.slug}>{item.title}</option>)}</select></label>
      <label>Full name<input required maxLength={120} autoComplete="name" {...register('name')} /></label>
      <label>Email address<input required type="email" maxLength={200} autoComplete="email" {...register('email')} /></label>
      <label>Phone number (optional)<input type="tel" maxLength={40} {...register('phone')} /></label>
      <label>Dedication (optional)<input maxLength={250} {...register('dedication')} /></label>
      <label className="check"><input type="checkbox" {...register('anonymous')} /> Keep my gift anonymous</label>
      <label className="check"><input type="checkbox" {...register('consent')} /> I agree to receive organization updates</label>
      {errors.root && <p role="alert">{errors.root.message}</p>}
      {!settings.data?.checkoutEnabled && <p role="status">{settings.isPending ? 'Checking checkout availability…' : 'Test checkout is currently unavailable.'}</p>}
      <button className="button green" disabled={isSubmitting || !settings.data?.checkoutEnabled}>{isSubmitting ? 'Preparing checkout…' : 'Continue to Stripe test checkout'}</button>
    </form></div>
  </Page>;
}

export function DonationStatus() {
  const [params] = useSearchParams();
  const token = params.get('ref');
  const [managementError, setManagementError] = useState('');
  const query = useQuery({
    queryKey: ['donation', token], enabled: !!token, retry: false,
    queryFn: () => api<{ status: string; reference: string; canManage: boolean; amount?: number; currency?: string }>('/donations/status/' + encodeURIComponent(token || '')),
    refetchInterval: query => query.state.data?.status === 'pending' ? 4000 : false,
  });
  const status = query.data?.status;
  return <Page title={status === 'paid' ? 'Thank you for your gift' : 'Donation status'}>
    <p role="status">{status === 'paid' ? 'Stripe verified your test donation of ' + money(query.data?.amount || 0, query.data?.currency) + '. Reference ' + query.data?.reference
      : status && status !== 'pending' ? 'Payment status: ' + status
      : query.isError || !token ? 'A verified donation could not be found.' : 'Waiting for payment confirmation from Stripe.'}</p>
    <div className="actions subsection">{query.data?.canManage && <button className="button green" onClick={async () => {
      setManagementError('');
      try {
        const result = await api<{ url: string }>('/donations/manage', 'POST', { token });
        window.location.assign(result.url);
      } catch (error) { setManagementError((error as Error).message); }
    }}>Manage or cancel monthly giving</button>}<Link className="textlink" to="/">Return home</Link></div>
    {managementError && <p role="alert">{managementError}</p>}
  </Page>;
}
