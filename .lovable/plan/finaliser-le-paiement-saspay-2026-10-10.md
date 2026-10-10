# Finaliser le paiement SasPay

Le code est déjà en place. Il reste la configuration et les tests.

1. Publier le site pour mettre en ligne l'adresse du webhook.
2. Dans SasPay, créer le webhook avec l'adresse https://networker-ai-buddy.lovable.app/api/public/saspay-webhook et cocher transaction.success, transaction.failed et transaction.cancelled.
3. Ajouter les secrets SASPAY_API_KEY puis SASPAY_WEBHOOK_SECRET.
4. Tests une fois les clés ajoutées :
   - paiement réussi : le plan est activé ;
   - paiement abandonné : rien ne change ;
   - même webhook reçu deux fois : un seul changement de plan ;
   - signature invalide : l'appel est rejeté (déjà vérifié en local).
