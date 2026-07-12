// Gmail developer accounts are allowed (they bypass domain restriction).
// All other accounts must use a DIU domain email.
export const allowedDomains = ['diu.edu.bd', 'daffodilvarsity.edu.bd']

export const developerAllowlist = [
    'tamzid.social@gmail.com',
    'tamjidul2003@gmail.com',
]

// Google will happily authenticate any Gmail account, so the university-email rule
// has to be enforced by us on every sign-in path, not just the registration form.
export function isEmailPermitted(email: string) {
    const normalized = email.trim().toLowerCase()
    const domain = normalized.split('@')[1] || ''

    return allowedDomains.includes(domain) || developerAllowlist.includes(normalized)
}
