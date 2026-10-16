import { Body, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

export interface PaymentNotificationProps {
  userName?: string
  email?: string
  plan?: string
  montant?: string
  reference?: string
}

function PaymentNotification({
  userName = 'Utilisateur',
  email = '',
  plan = '',
  montant = '',
  reference = '',
}: PaymentNotificationProps) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>Nouvelle demande de paiement — {userName} · {plan}</Preview>
      <Body style={{ backgroundColor: '#0F172A', margin: 0, padding: '24px 0' }}>
        <Container style={{ backgroundColor: '#1E293B', borderRadius: 12, padding: 32, maxWidth: 480 }}>
          <Heading style={{ color: '#F8FAFC', fontSize: 22, margin: '0 0 16px' }}>
            Nouvelle demande de paiement
          </Heading>
          <Section>
            <Text style={{ color: '#CBD5E1', fontSize: 15, margin: '6px 0' }}>
              <strong style={{ color: '#F8FAFC' }}>Nom :</strong> {userName}
            </Text>
            <Text style={{ color: '#CBD5E1', fontSize: 15, margin: '6px 0' }}>
              <strong style={{ color: '#F8FAFC' }}>E-mail :</strong> {email}
            </Text>
            <Text style={{ color: '#CBD5E1', fontSize: 15, margin: '6px 0' }}>
              <strong style={{ color: '#F8FAFC' }}>Plan :</strong> {plan}
            </Text>
            <Text style={{ color: '#CBD5E1', fontSize: 15, margin: '6px 0' }}>
              <strong style={{ color: '#F8FAFC' }}>Montant :</strong> {montant}
            </Text>
            <Text style={{ color: '#CBD5E1', fontSize: 15, margin: '6px 0' }}>
              <strong style={{ color: '#F8FAFC' }}>Référence :</strong> {reference}
            </Text>
          </Section>
          <Text style={{ color: '#64748B', fontSize: 12, marginTop: 24 }}>
            MLM Boost AI — notification automatique
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: PaymentNotification,
  subject: (d: Record<string, any>) =>
    `Paiement à vérifier — ${d.userName ?? 'Utilisateur'} · ${d.plan ?? ''}`,
  displayName: 'Notification de paiement (admin)',
  previewData: {
    userName: 'Awa Ndi',
    email: 'awa@example.com',
    plan: 'Pro',
    montant: '5 000 FCFA',
    reference: 'OM-123456',
  },
  to: 'nouridine237@gmail.com',
} satisfies TemplateEntry
