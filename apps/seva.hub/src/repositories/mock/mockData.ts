import type { BootstrapResponse } from '../../../shared/contracts/appContracts.js';

export const mockBootstrapData: BootstrapResponse = {
  success: true,
  user: {
    id: 'mock-user-1',
    email: 'volunteer@example.com',
    name: 'Mock Volunteer',
    picture: 'https://via.placeholder.com/32'
  },
  campaignId: 'cmpLeads01AbcDefGhIJk',
  config: {
    id: 'cfgMain01AbcDefGhIJK9',
    campaigns: [
      {
        id: 'cmpLeads01AbcDefGhIJk',
        name: 'July Leads Campaign',
        type: 'Leads',
        message: 'Hi {name}, greetings from Art of Living.',
        showDonePrograms: true
      },
      {
        id: 'cmpMembs01AbcDefGhIJK',
        name: 'Member Reconnect Drive',
        type: 'Members',
        message: 'Hi {name}, warm greetings from {campaign}.',
        showDonePrograms: true
      }
    ],
    uiByType: {
      Leads: {
        queueTitle: 'Leads Queue',
        filterOptions: [
          { id: 'all', label: 'All Leads' },
          { id: 'hot', label: 'Hot' },
          { id: 'followup_today', label: 'Follow-up Today' },
          { id: 'no_answer', label: 'No Answer' }
        ]
      },
      Members: {
        queueTitle: 'Participants Queue',
        filterOptions: [
          { id: 'all', label: 'All Members' },
          { id: 'active', label: 'Active' },
          { id: 'followup_today', label: 'Follow-up Today' },
          { id: 'callback', label: 'Call Back' }
        ]
      }
    },
    qualityMetaMap: {
      Hot: {
        icon: '🟢',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      },
      Warm: {
        icon: '🟡',
        className: 'bg-amber-50 text-amber-700 border-amber-200'
      },
      Cold: {
        icon: '⚪',
        className: 'bg-slate-100 text-slate-600 border-slate-200'
      },
      Quality: {
        icon: '✏️',
        className: 'bg-sky-50 text-sky-700 border-sky-200'
      },
      Engagement: {
        icon: '✏️',
        className: 'bg-sky-50 text-sky-700 border-sky-200'
      },
      Active: {
        icon: '🟢',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      },
      Occasional: {
        icon: '🟡',
        className: 'bg-amber-50 text-amber-700 border-amber-200'
      },
      Inactive: {
        icon: '🔴',
        className: 'bg-rose-50 text-rose-700 border-rose-200'
      },
      Shifted: {
        icon: '⚫',
        className: 'bg-zinc-100 text-zinc-700 border-zinc-300'
      }
    },
    statusIconMap: {
      Response: '✏️',
      Connected: '📞',
      Busy: '⏳',
      'No Answer': '🔕',
      Interested: '✅',
      Registered: '🎟️',
      'Not Interested': '⛔',
      Reached: '📲',
      'Will Attend': '🙌',
      Maybe: '🤔',
      'Not Available': '🚫',
      'Call Back': '🔁'
    },
    defaultStatusIcon: '💬',
    defaultCampaignMessage: 'Hi {name}, greetings from Art of Living.',
    whatsappCountryCode: '91',
    centerWhatsappNumber: '918884560660',
    allowedUsers: ['volunteer@example.com', 'other-volunteer@example.com'],
    volunteers: [
      { email: 'volunteer@example.com', name: 'Mock Volunteer' },
      { email: 'other-volunteer@example.com', name: 'Other Volunteer' }
    ],
    programs: [
      { code: 'HP', label: 'Happiness Program' },
      { code: 'VTP', label: 'Volunteer Training Program' },
      { code: 'DSN', label: 'Divya Samaj Nirman' },
      { code: 'IP', label: 'Intuition Process' },
      { code: 'IP2', label: 'Intuition Process 2' },
      { code: 'Sahaj', label: 'Sahaj Samadhi Meditation' },
      { code: 'YES+', label: 'YES Plus' }
    ],
    programDisplayOrder: ['HP', 'VTP', 'DSN', 'IP', 'IP2', 'Sahaj', 'YES+'],
    showDonePrograms: true
  },
  leads: [
    {
      id: 'leadAarv01AbcDefGhIJK',
      mobile: '9876543210',
      name: 'Aarav Sharma',
      quality: 'Hot',
      followUp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      lastUpdated: 'Just now',
      status: 'Call Back',
      notes: 'Requested morning callback',
      campaignId: 'cmpLeads01AbcDefGhIJk',
      campaignType: 'Leads',
      assignedVolunteerEmail: 'volunteer@example.com',
      wishlistPrograms: 'HP,SSDY',
      donePrograms: ''
    },
    {
      id: 'leadNish01AbcDefGhIJK',
      mobile: '9123456780',
      name: 'Nisha Verma',
      quality: 'Warm',
      followUp: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      lastUpdated: 'Just now',
      status: 'Connected',
      notes: 'Interested in weekend batch',
      campaignId: 'cmpLeads01AbcDefGhIJk',
      campaignType: 'Leads',
      assignedVolunteerEmail: 'other-volunteer@example.com',
      wishlistPrograms: 'DSN',
      donePrograms: 'HP'
    },
    {
      id: 'leadAarv01AbcDefGhIJK',
      mobile: '9876543210',
      name: 'Aarav Sharma',
      quality: 'Active',
      followUp: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      lastUpdated: 'Just now',
      status: 'Reached',
      notes: 'Member reconnect record',
      campaignId: 'cmpMembs01AbcDefGhIJK',
      campaignType: 'Members',
      assignedVolunteerEmail: 'volunteer@example.com',
      wishlistPrograms: 'VTP',
      donePrograms: 'HP'
    },
    {
      id: 'memberNew01AbcDefGhIJK',
      mobile: '9988776655',
      name: 'Newest Unassigned Member',
      quality: 'Active',
      followUp: 'Follow-up',
      lastUpdated: 'Just now',
      status: 'Response',
      notes: 'First unassigned member in Sheet order',
      campaignId: 'cmpMembs01AbcDefGhIJK',
      campaignType: 'Members',
      assignedVolunteerEmail: '',
      wishlistPrograms: '',
      donePrograms: 'HP'
    },
    {
      id: 'memberOcc01AbcDefGhIJK',
      mobile: '9988776644',
      name: 'Occasional Unassigned Member',
      quality: 'Occasional',
      followUp: 'Follow-up',
      lastUpdated: 'Just now',
      status: 'Response',
      notes: 'Second unassigned member in Sheet order',
      campaignId: 'cmpMembs01AbcDefGhIJK',
      campaignType: 'Members',
      assignedVolunteerEmail: '',
      wishlistPrograms: 'VTP',
      donePrograms: 'HP'
    }
  ]
};
