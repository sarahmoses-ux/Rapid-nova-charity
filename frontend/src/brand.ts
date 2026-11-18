import { BookOpen, Droplets, HeartPulse, HandHeart, Sprout, Users, GraduationCap, Scissors, House, ShieldCheck, HeartHandshake, Compass } from 'lucide-react';

export const hero = '/images/volunteers-sorting.jpg';
export const volunteerPhoto = '/images/volunteers-packing.jpg';

export const proposed = [
  {
    slug: 'girls-education', title: 'Girls’ Education & Empowerment', icon: GraduationCap,
    summary: 'Exploring scholarships, mentorship and leadership opportunities that help girls stay in school and pursue their goals.',
    photo: {
      src: '/images/cause-girls.webp', alt: 'A student raises her hand in class', credit: 'Taylor Flowe',
      source: 'https://unsplash.com/photos/student-raising-hand-in-classroom-NTur2_QKpg0',
    },
  },
  {
    slug: 'hair-care', title: 'Haircuts & Hair Care', icon: Scissors,
    summary: 'Exploring free haircuts, basic hair care supplies and partnerships with local barbers and stylists.',
    photo: {
      src: '/images/cause-hair.webp', alt: 'A barber trims hair with scissors and a comb', credit: 'Josh Marty',
      source: 'https://unsplash.com/photos/barber-cutting-hair-with-scissors-and-comb-sdh4g0H-uXg',
    },
  },
  { slug: 'food-security', photo: { src: '/images/volunteers-packing.jpg', alt: 'Volunteers packing food into bags', credit: 'Joel Muniz', source: 'https://unsplash.com/photos/people-packing-food-in-plastic-bags-qvzjG2pF4bE' }, title: 'Hunger & Food Security', icon: Sprout, summary: 'Strengthening access to nutritious food through community-led solutions.' },
  { slug: 'education', photo: { src: '/images/cause-education.webp', alt: 'Students seated at tables in a library', credit: 'Ilia Bronskiy', source: 'https://unsplash.com/photos/a-library-filled-with-lots-of-books-and-people-sitting-at-tables-gdZ9GPNi_VM' }, title: 'Education & Scholarships', icon: BookOpen, summary: 'Helping learners overcome barriers to education and build a future of their choosing.' },
  { slug: 'clean-water', photo: { src: '/images/cause-water.webp', alt: 'Water running from a kitchen faucet into a glass', credit: 'Jacek Dylag', source: 'https://unsplash.com/photos/person-opening-faucet-Vve7XkiUq_Y' }, title: 'Clean Water & Sanitation', icon: Droplets, summary: 'Exploring reliable access to safe water and practical sanitation support.' },
  { slug: 'healthcare', photo: { src: '/images/cause-healthcare.webp', alt: 'A clinician using a stethoscope during an exam', credit: 'National Cancer Institute', source: 'https://unsplash.com/photos/a-doctor-examining-a-womans-chest-with-a-stethoscope-JUjmXaIvsLM' }, title: 'Healthcare & Medical Assistance', icon: HeartPulse, summary: 'Reducing barriers between people and the essential care they need.' },
  { slug: 'community', photo: { src: '/images/cause-community.webp', alt: 'A group working together to pot plants', credit: 'Jonathan Kemper', source: 'https://unsplash.com/photos/a-group-of-people-planting-plants-YvmphETI39Q' }, title: 'Community Development', icon: Users, summary: 'Supporting local leadership and long-term solutions shaped by communities.' },
  { slug: 'disaster-relief', photo: { src: '/images/cause-disaster.webp', alt: 'Rescue equipment in an open fire truck compartment', credit: 'Zaki', source: 'https://unsplash.com/photos/fire-truck-with-open-compartment-showing-equipment-eLzBZbOVNj4' }, title: 'Disaster Relief', icon: HandHeart, summary: 'Exploring ways to support preparedness and recovery after emergencies.' },
  { slug: 'poverty-alleviation', title: 'Poverty Alleviation', icon: HeartHandshake, summary: 'Exploring practical support for households facing financial hardship, including referrals and access to essential services.' },
  { slug: 'child-welfare', title: 'Child Welfare', icon: ShieldCheck, summary: 'Exploring ways to connect children and caregivers with services that support safety, stability and well-being.' },
  { slug: 'homelessness-support', title: 'Homelessness Support', icon: House, summary: 'Exploring access to basic supplies, shelter referrals and support navigating housing services.' },
  { slug: 'youth-empowerment', title: 'Youth Empowerment', icon: Compass, summary: 'Exploring mentorship, practical skills training and opportunities for young people to lead community projects.' },
];

export const legal = {
  privacy: 'Privacy Policy', terms: 'Terms of Use', refunds: 'Donation and Refund Policy',
  cookies: 'Cookie Policy', accessibility: 'Accessibility Statement',
  volunteer: 'Volunteer Policy', safeguarding: 'Safeguarding Policy',
};
