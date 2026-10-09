CREATE TABLE public.scripts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title text NOT NULL,
 category text NOT NULL CHECK (category IN ('Premier contact', 'Relance', 'Objections', 'Invitation', 'Suivi d’équipe')),
 content text NOT NULL,
 sort_order integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scripts TO authenticated;
GRANT ALL ON public.scripts TO service_role;
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY scripts_read_authenticated ON public.scripts FOR SELECT TO authenticated USING (true);
CREATE POLICY scripts_insert_admin ON public.scripts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY scripts_update_admin ON public.scripts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY scripts_delete_admin ON public.scripts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER scripts_set_updated_at BEFORE UPDATE ON public.scripts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.scripts (title, category, content, sort_order) VALUES
('Approche d’un contact chaud', 'Premier contact', E'Salut [Prénom], comment vas-tu ?\nJ’ai pensé à toi en découvrant [Produit].\nSi le sujet t’intéresse, je peux te partager quelques infos simples.\nTu préfères qu’on en parle ici ou lors d’un petit appel ?', 1),
('Approche d’un contact froid sur les réseaux sociaux', 'Premier contact', E'Bonjour [Prénom], j’ai découvert ton profil et ton intérêt pour ce sujet.\nJe partage des informations sur [Produit], et je me suis dit que cela pourrait t’intéresser.\nEst-ce que tu serais d’accord pour recevoir une courte présentation ?\nSi ce n’est pas le bon moment, aucun souci.', 2),
('Réponse à un like ou un commentaire', 'Premier contact', E'Salut [Prénom], merci pour ta réaction à mon post !\nTu voulais en savoir un peu plus sur [Produit] ?\nJe peux te répondre ici, sans engagement.\nQu’est-ce qui a attiré ton attention ?', 3),
('Relance douce après 3 jours sans réponse', 'Relance', E'Salut [Prénom], je reviens vers toi au sujet de [Produit].\nTu n’as peut-être pas eu le temps de lire mon dernier message.\nEst-ce que tu souhaites toujours en discuter ?\nSi ce n’est pas une priorité pour toi, dis-le-moi simplement.', 4),
('Relance après une présentation', 'Relance', E'Salut [Prénom], merci d’avoir pris le temps de découvrir [Produit].\nQu’as-tu pensé de la présentation ?\nY a-t-il un point que tu aimerais éclaircir ?\nPrends le temps qu’il te faut, je reste disponible.', 5),
('« Je n’ai pas le temps »', 'Objections', E'Je comprends [Prénom], ton temps est précieux.\nOn peut commencer par une courte explication de [Produit], si tu le souhaites.\nAvant d’aller plus loin, voyons ensemble le temps réellement nécessaire.\nSi cela ne convient pas à ton rythme, mieux vaut le savoir dès maintenant.', 6),
('« Je n’ai pas d’argent »', 'Objections', E'Je comprends [Prénom], il faut respecter ton budget.\nPour [Produit], je peux t’expliquer clairement le prix et les éventuels frais.\nNe t’endette pas et ne touche pas à l’argent destiné à tes besoins essentiels.\nOn peut simplement en parler, ou laisser cela de côté pour le moment.', 7),
('« C’est une pyramide ? »', 'Objections', E'Ta question est importante, [Prénom].\nUn MLM légitime repose sur de vraies ventes de produits à des clients, pas seulement sur le recrutement.\nUn système pyramidal dépend surtout des paiements des nouveaux entrants ; avoir un produit ne suffit pas à le rendre légitime.\nPour [Produit], vérifions les ventes réelles, les frais, les règles de rémunération et la conformité locale.\nSi ces informations ne sont pas claires, mieux vaut ne pas s’engager.', 8),
('Inviter à une présentation', 'Invitation', E'Salut [Prénom], une présentation de [Produit] est prévue prochainement.\nOn y parlera du produit, de son prix et du fonctionnement de l’activité.\nEst-ce que tu aimerais recevoir la date et les détails ?\nTu peux venir écouter et poser tes questions, sans engagement.', 9),
('Inviter à rejoindre l’équipe', 'Invitation', E'Salut [Prénom], aimerais-tu discuter de la possibilité de rejoindre notre équipe autour de [Produit] ?\nJe peux t’expliquer les tâches, les frais éventuels et l’accompagnement proposé.\nL’activité demande du travail et les résultats varient ; aucun revenu n’est garanti.\nOn peut regarder ensemble si cela te convient, sans pression.', 10),
('Message de bienvenue à un nouveau recruté', 'Suivi d’équipe', E'Bienvenue dans l’équipe, [Prénom] !\nPour commencer, prenons le temps de bien découvrir [Produit] et les règles de l’activité.\nOn choisira ensuite une première action simple, adaptée à ton rythme.\nJe suis là pour répondre à tes questions et t’accompagner.', 11),
('Remotiver un membre inactif', 'Suivi d’équipe', E'Salut [Prénom], comment te sens-tu dans l’équipe en ce moment ?\nSi tu bloques sur [Produit] ou sur la prise de contact, on peut en parler tranquillement.\nOn peut choisir une petite action réaliste pour cette semaine.\nEt si tu as besoin d’une pause, je respecte aussi ton choix.', 12);