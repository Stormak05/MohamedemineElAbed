# Clausus : chambre 104 (Three.js)

Le jeu : un patient enfermé dans sa chambre d'hôpital psychiatrique, la nuit,
sous la pluie. Rendu rétro basse résolution (tramage, grain, vignette qui se resserre avec la maladie).

Dans le monorepo, le site (`apps/web`) affiche le jeu à sa racine, après un écran d'accueil (compte facultatif) : `bun run dev` à la racine puis
http://localhost:3001/ (en sortant de la chambre, on continue dans l'hôpital). Les fichiers du jeu sont servis sous `/game/`.
`shell.js` relie le jeu au site : le pseudo du joueur et les boutons Compte et Déconnexion (ou « Invité » et Se connecter) en haut du menu principal
(absents quand le jeu tourne seul). Le build (`node build.mjs`, lancé par turbo) ne garde que les fichiers
d'exécution dans `dist/` (ni `blockbench/` ni `preview/`), que `apps/web` recopie dans son propre build.

Seul, sans le reste du monorepo : `node packages/game/serve.mjs` (ou `bun run serve` dans ce dossier) puis http://localhost:5175/
Via Tailscale (hynet) : `HOST=100.64.0.160 PORT=3389 node packages/game/serve.mjs` → http://bora.hynet:3389/
(l'ACL hynet n'ouvre que les ports 22, 3389 et 3773 vers bora).
Sur téléphone (même Wi-Fi) : `HOST=0.0.0.0 node packages/game/serve.mjs` puis ouvrir `http://<ip-du-pc>:5175/`.

## Menus
- **Écran de chargement** (`loading.js`, `#loading` dans `index.html`) : affiché par le HTML dès l'ouverture, barre de
  progression selon les modèles téléchargés, puis préparation de la scène et compilation des shaders ; il s'efface au
  premier rendu.
- **Carte graphique** (`gpu.js`) : avant de créer le rendu, le jeu vérifie que WebGL passe par la carte graphique
  (`failIfMajorPerformanceCaveat` et nom du moteur : SwiftShader, llvmpipe, Microsoft Basic Render…). Sans WebGL, un écran
  explique comment activer l'accélération matérielle dans le navigateur détecté (Chrome, Edge, Brave, Opera, Firefox, Safari),
  avec l'adresse de la page de réglages à copier. En rendu logiciel : même aide (« Continuer quand même », « Ne plus me prévenir »)
  et réglages réduits une fois (ombres, miroirs, pixelisation 240), remis quand la carte revient. Si la carte décroche en jeu
  (`webglcontextlost`), un écran propose de recharger.
- **Menu principal** (par-dessus la chambre filmée en direct) : Commencer → écran d'information (maladies mentales, jeu réalisé pour un projet de cours), Classement (dans le site), Options, Crédits, Quitter.
  En haut à droite : pseudo, Compte, Déconnexion (invité : Se connecter).
- **Pause** (Échap) : Reprendre, Sauvegarder, Recommencer, Publier mon score (une fois sorti de la chambre), Classement, Options, Menu principal, carte des commandes.
- **Sauvegarde** (dans le site, joueurs connectés seulement ; absente quand le jeu tourne seul) : automatique toutes les
  45 s de jeu, à la pause et au retour au menu principal, ou avec Sauvegarder. Le menu principal propose alors
  « Reprendre la partie » (avec l'heure de la sauvegarde) et « Nouvelle partie », qui la remplace. Recommencer et la fin
  de partie l'effacent. Sont gardés : temps, santé mentale (et donc le délabrement), cachets, pièces, indices, erreurs,
  lampe, tiroir, PC allumé et fenêtres ouvertes, porte, sortie de la chambre, position (la dernière hors ascenseur). En invité,
  Sauvegarder explique qu'il faut un compte et propose de se connecter ; la partie est sauvegardée au retour.
- **Classement** (dans le site uniquement, page `/classement` d'`apps/web`) : sortir de l’hôpital fige le temps, les indices,
  les erreurs et la santé mentale ; le joueur publie ce score depuis l'écran de fin
  (un invité est envoyé vers la connexion, et le score part une fois connecté). Score (`score.js`, recalculé
  par le serveur) : 10 000 − 5/s − 500/indice − 100/erreur + 10/% de santé restante. Chaque joueur garde son meilleur score.
  Une partie aidée par les options développeur (santé figée ou plus lente, noclip, vitesse, triches) n'est pas classée.
- **Options** : Général (sensibilité, axe Y, champ de vision, balancement/roulis de tête, tremblements), Commandes
  (touches réassignables, affichées selon la disposition réelle du clavier ; réglages de l'écran tactile), Graphismes (plein écran, pixelisation,
  luminosité, ombres, effets rétro, contour des objets utilisables), Audio (général, effets, ambiance, voix), **Développeur** (tous les effets de
  post-traitement, lumières, pluie, éclairs, santé mentale figée/réglable, hallucinations, délabrement forcé,
  noclip, vitesse, téléportation, triche de progression, infos de débogage). Réglages sauvegardés dans le navigateur.
- Paramètres d'URL : `?jouer` saute le menu, `?duree=300` force la durée de la jauge.

## Commandes
Clavier et souris (touches réassignables dans Options > Commandes, les indices du jeu affichent la touche choisie) :
- ZQSD / WASD ou flèches : se déplacer · souris : regarder · E, Espace ou clic : interagir
  (l'objet visé est entouré d'un contour clair ; les petits objets ont une zone de visée agrandie, et rien ne se vise à travers un meuble)
- Pour utiliser un objet, le joueur va se placer là où sa main l'atteint vraiment (en contournant les meubles, penché au-dessus
  d'une table ou d'un lit, accroupi si c'est bas, jamais derrière un mur), puis se relève : tiroir tiré par la poignée (le corps suit),
  combiné décroché et porté à l'oreille, cadran tourné du doigt, pièce glissée dans le monnayeur ou le distributeur, bracelet,
  carnet et pièces posés sur la paume et regardés de près (un pas en arrière contre un mur), puis reposés exactement à leur place,
  cachet porté à la bouche, feuille levée pour la lire, oreiller soulevé, interrupteur et bouton d'appel pressés, blouse prise par
  les épaules et enfilée, porte de la chambre : poignée abaissée. Portes de l'hôpital : poussées de la paume du côté où elles
  s'ouvrent, tirées par la poignée de l'autre côté (le joueur s'écarte du battant), refermées par la poignée, secouées si verrouillées.
- C : prendre un cachet · F : lampe torche · M : son · Échap : pause
- Maintenir Échap : quitter le plein écran (sur les navigateurs compatibles avec Keyboard Lock ; sinon, un appui court conserve le comportement du navigateur).
- Au PC : souris + clavier pour utiliser MEDISYS · clic droit ou Échap : se lever
- Cadenas des boîtes : flèches ou chiffres, Entrée · choix de dialogue : clic ou touches 1 à 3

Écran tactile (téléphone, tablette ; activé automatiquement, ou forcé dans Options > Commandes > Écran tactile) :
- **Moitié gauche** : joystick dynamique, il apparaît sous le pouce et le suit au-delà du bord ; plus on pousse, plus on marche vite.
- **Moitié droite** : glisser pour regarder (sensibilité réglable). Les deux pouces marchent en même temps.
- **Toucher un objet** pour l'utiliser, ou viser avec le centre et appuyer sur **✋** (le bouton s'allume quand un objet est visé).
- Toucher l'écran fait avancer les dialogues (✋ devient ▶) et repose un document.
- Boutons **cachet** (avec le nombre restant) et **lampe** quand on les a, **II** en haut à droite : pause.
- Au PC : toucher l'écran pour cliquer (on peut glisser les fenêtres), **⌨ Clavier** (la vue remonte pour rester
  lisible), **Se lever ✕**.
- Options : joystick à droite pour les gauchers, opacité des boutons, toucher-pour-utiliser, plein écran + paysage au
  lancement (Android). En portrait, un écran propose de tourner l'appareil. Les menus se compactent sur petit écran.

## Boucle de jeu (démo)
- **Réveil** : une nouvelle partie commence allongé dans le lit, comme à la fin du jeu ; le patient s'assoit au bord, se lève, puis la main revient au joueur (`wakeUp` dans `main.js`). Reprendre une sauvegarde repart directement là où on était.
- **Pause pendant les dialogues et lectures** : deux options indépendantes dans **Général**, désactivées par défaut, suspendent le chronomètre et la baisse de santé mentale. Les dialogues incluent les choix de réponse ; la lecture inclut les documents et fichiers ouverts sur ordinateur, mais pas la navigation dans les dossiers ni le décryptage.
- **Santé mentale** : se vide en 10 min (`?duree=300` pour changer). Chaque cachet rend 40 %. Les quatre cachets gratuits sont répartis : deux dans le flacon de la chambre, un sur le bureau des archives et un sur celui du Dr Morel. Le distributeur de la pharmacie permet d’en acheter d’autres avec les pièces.
  Dès le début, même à pleine santé : portes qui se referment et pas fantômes à proximité du joueur (premier son après 14 s, puis toutes les 26–32 s à 100 %). Les hallucinations se rapprochent progressivement jusqu’à 6–12 s à santé nulle ; au-dessus de 78 %, elles restent limitées aux portes et aux pas.
  Plus elle baisse : vignette plus serrée, vision double, image qui ondule, démarche instable, battements de cœur,
  hallucinations auditives (chuchotements, coups à la porte, pas, souffle, sonnerie fantôme) et visuelles (silhouette
  qui disparaît quand on la regarde, écran du PC qui affiche des messages).
- **Voix (`voix.js`)** : les répliques HAL_01 à HAL_15 de la fiche d'enregistrement. Chacune s'entend et s'affiche en
  **image subliminale** à la Alan Wake (rafale de quelques images : phrase plein écran sur du noir, mots isolés, négatif).
  Déclencheurs : hallucinations (les plus dures seulement quand on va mal), murs « ILS TE VOIENT / ILS ÉCOUTENT / SORS »
  quand on les regarde, glitch du PC (« IL NE SORTIRA JAMAIS ») quand on est assis devant, sonnette d'infirmière, dessins
  « IL MENT » (en boucle), silhouette dans le dos (« Regarde derrière toi »). Option *Graphismes › Images subliminales*
  (Complètes / Douces sans flash plein écran / Désactivées). Les prises enregistrées vont dans `assets/audio/voix/` et se
  déclarent dans `voix.json` (`{ "HAL_06": ["hal_06_jules_neutre", …] }`) : plusieurs prises jouées ensemble font la
  foule ; sans prise, seul le texte s'affiche.
- **Délabrement** : la chambre est propre au départ. Selon la santé mentale, chaque module (murs, porte, sol, plafond, 2 m)
  passe par 4 états, mais **seulement quand il est hors du champ de vision**. Rien ne change devant la caméra.
- **Histoire** (document de game design de l'équipe, `histoire.js`) : un patient persuadé de ne pas être malade s'échappe en
  se faisant passer pour un médecin. Solutions :
  1. **Chambre 104** fermée à clé. Une boîte oubliée par un soignant sur le bureau contient la clé de service ; son cadenas à 4 chiffres utilise : 2 derniers chiffres de la chambre + n° de patient. Chambre 104
     (bracelet, feuille de soins), patient n° 27 (fiche sur le bureau) → **0427**. Une pièce dans le tiroir du bureau.
  2. **Archives** (étage 1) : lampe torche dans le tiroir du bureau ; sur le PC, `ETAGE_1_AILE_B\CH_104\PATIENT_27.TXT` →
     psychiatre référent **Dr William Morel** (le Dr Hélène Morel est un piège : ancien occupant).
  3. **Laverie**, noire sans la lampe : sur le portant, la blouse du Dr William Morel contient son trousseau. L'enfiler est un
     choix. Le trousseau ouvre l'escalier (et appelle l'ascenseur, qui attend au RDC).
  - **Arrivée au RDC** : sans la blouse, le personnel le reconnaît (sédatif, fin « Rattrapé ») ; avec, l'infirmière de
    l'accueil lui parle à moins de 3 m et sans obstacle entre eux (choix de réponse : avouer = rattrapé).
  4. **Poste de sécurité 001** (trousseau) : note sur le casier ; PC, programme `DECHIFFRE.ALG` : corriger `resultat ← ""`,
     `(position − 5 + 26) MOD 26`, `resultat ← resultat + alphabet[nouvelle_position]`, puis « Tester » → CLAUSUS → le casier
     s'ouvre → clé de la salle de réunion.
  5. **Salle de réunion 008** : planning de garde, 21 h 00 → 23 h 00 : dossiers (6), réunion (3), visite (8), traitements (2),
     transmissions (5). Le nom du Dr Morel s'allume sur l'annuaire ; code du coffret = 2, 3, 6, 8 → **2368**.
  6. **Cabinet du Dr W. Morel 007** (trousseau) : coffret 2368 → carte d'accès → portique de **Sortie** → il sort sous la
     pluie, traverse la cour jusqu'à la route… et se réveille dans sa chambre (fin « Réveil », voir « La fin » plus bas).
  - **Bonus** : pièces cachées (chambre ×3, archives, laverie, WC, cantine, poste de sécurité, salle de réunion, WC du RDC) ;
    une pièce = un indice au téléphone (chambre ou accueil, un par énigme au plus) ou un cachet au distributeur de la pharmacie.
  - Objets du puzzle faits en code (cadenas, portant et blouses, casier, tableaux, coffret, distributeur) : **à remplacer par
    des modèles Blockbench, à valider par Jules**.
- **Téléphones payants** (chambre 104, accueil) : 1 pièce = 1 appel = 1 indice sur l'énigme en cours, un seul par énigme.
  Animations : pièce dans le monnayeur, décroché, cadran, combiné à l'oreille, bulles de dialogue (doublage prévu).
- **Les autres, entendus** (`ambiance.js`) : sans jamais bloquer le joueur, chaque voix joue une fois, là d'où elle vient, avec
  son sous-titre, et 15 à 25 s séparent deux scènes. Haut-parleurs (visites terminées, test d'alarme, pharmacie fermée, « le docteur
  Morel est demandé à l'accueil » une fois la blouse portée, « Patient cent quatre, vous êtes attendu » quand il perd pied),
  voix de l'ascenseur à l'arrivée (« Sous-sol. » une fois quand il va mal). La ronde de Lucas Perrin, l'infirmier de nuit,
  jamais vu : son talkie au loin, puis devant la 104 tant que la porte est fermée, et à travers les portes des 101, 102 et 107.
  Les autres patients derrière leur porte fermée, quand on passe dans le couloir : M. Garnier compte (101), Mme Roux sort le
  cinq (102), le patient de la 107 crie, la patiente de la 105. Au RDC : l'infirmière appelle Perrin au talkie quand on s'est
  éloigné d'elle (il répond que la 104 dort), l'agent de sécurité pendant sa ronde, puis après l'ouverture du casier.
  **Téléphone** : sans pièce, le répondeur du standard (une fois, et une seconde, hallucinée, quand il va mal). Avec une pièce,
  le patient répond (« Allô ? », « Qui est à l'appareil ? »…), la voix esquive, se lasse des mêmes questions, remarque les
  cachets, raccroche quand « quelqu'un vient » au téléphone de l'accueil, et finit sur « …Et cette fois, ne reviens pas. ».
  Pensées à voix haute ajoutées : réveil, bouton d'appel, porte (au deuxième essai), cadenas, archives, noms brodés des blouses,
  cachet, silhouette, Léa, tonnerre, angoisse quand la santé mentale baisse. Celles qui reviennent ont un délai (60 à 150 s).
- **Léa** (`LEA` dans `histoire.js`) : la fille de la photo et des dessins « PAPA », entendue, jamais vue, jamais expliquée.
  Quand le patient perd pied : un appel fantôme (« Papa ? Tu rentres quand ? », une fois par nuit), des phrases après son
  rire, « Un, deux, trois… soleil ! » quand la silhouette disparaît, « Je t'ai fait un dessin ! » devant les dessins (une
  fois), et « Bonne nuit, papa. » au réveil de la fin. Sous-titre « LÉA ? » ; le son vient de
  `assets/audio/voix/<code>.mp3` (codes de la fiche de doublage : `LEA_01.mp3`…), chargé au premier usage, sous-titre seul
  tant que le fichier manque.

## L'hôpital autour de la chambre (`hopital/`)
La chambre du joueur est la 104, à l'étage 1 du plan. Sa porte s'ouvre directement sur le couloir : celui-ci
se termine dans l'alignement du mur de la porte, avec un renfoncement devant elle (au fond, les WC de l'étage). Plus d'écran de fin en sortant : on continue dans l'hôpital.
- **Plans** : `hopital/plan.js` reprend les deux plans (Étage 0 et Étage 1, même échelle : 1 px = 7,5 cm, couloirs de 3 m,
  chambres de 6 × 6 m). L'étage 1 se pose sur le bloc principal du RDC (décalage `F1`) ; escalier et ascenseur sont alignés.
  `ORIGIN` cale le plan sur la chambre (coordonnées de `main.js` inchangées : sol de la chambre à y = 0, RDC à y = -3,3).
  La rangée nord de l'étage 1 passe de 79 à 83 px de profondeur pour que la chambre (6 m) y tienne. Murs, portes (position,
  largeur, sens d'ouverture) et pièces sont décrits en pixels du plan : modifier le plan = modifier ce fichier.
- **Portes** battantes animées (E pour ouvrir / fermer), doubles portes pour la cantine et les archives, plaque avec le nom
  de la pièce côté couloir. Portes à clé : escalier de l'étage, poste de sécurité, cabinet 007 (trousseau), salle de réunion (sa clé), sortie (carte).
- **Clin d'œil** : chambre 109 (hors énigmes), *The King in Yellow* posé sur le bureau (`assets/props/king_in_yellow.glb`,
  source `modeles/objets/king_in_yellow.bbmodel`) ; le regarder fait penser « Je tiendrai ma promesse. ».
- **Escalier** : deux volées en U de 11 marches avec palier intermédiaire, rampes, garde-corps ; on monte et descend en marchant.
- **Ascenseur** : bouton d'appel à chaque étage (s'allume), indicateur d'étage au-dessus des portes, portes palières et de cabine
  coulissantes, panneau intérieur (1, RDC, alarme). La cabine accélère et ralentit, la vue vibre pendant le trajet, sonnerie
  à l'arrivée ; les portes se rouvrent si quelqu'un est dans le passage.
- **Habillage** (`hopital/habillage.js`, `hopital/mobilier.js`) : les modules de `assets/decor/` et les objets de `assets/props/` sont posés sur le plan, sur la grille de 2 m de la chambre. Les modules ne sont jamais déformés : ils sont coupés là où un mur s'arrête ou une porte s'ouvre. Le plan reste la coque et les collisions. Le mobilier est fusionné par case et par matériau.
- **Délabrement** : même règle que la chambre. Murs, sols et plafonds sont découpés en cases de 8 m (et chaque porte à part),
  qui passent par 4 états selon la santé mentale, seulement hors du champ de vision : traces, puis taches d'eau, fissures,
  peinture écaillée, carreaux manquants, puis coulures sombres, plâtre à nu, griffures, flaques, dalles de plafond tombées.
- **Lumière** : un groupe de 8 lumières suit les néons les plus proches. Elles s'éteignent dans la chambre (sinon elles
  traverseraient ses murs) et s'allument en approchant de la porte ouverte. Seuls les murs autour de la chambre portent
  des ombres, pour que la lampe de la chambre n'éclaire pas le couloir.
- Le nom de l'étage et de la pièce s'affiche sous l'horloge hors de la chambre. Options > Développeur > Téléporter :
  couloir, escalier, ascenseur, accueil.
- `hopital/batiment.js` construit le bâtiment (géométrie fusionnée par case, collisions, sols praticables, néons) ;
  `hopital/jeu.js` le branche sur `main.js` (collisions, escalier, ascenseur, lumières, délabrement).
- **La fin** (`fin.js`) : derrière le portique « Sortie », la façade sud, un perron sous un auvent (néon qui grésille), le
  parvis mouillé (flaques, fauteuil roulant abandonné), une grille ouverte, la route et ses lampadaires, la ville au loin.
  Passer le portique avec la carte lance la marche dehors (≈ 28 s, un clic ou une touche la passe) : la porte claque
  derrière, quelques pas sous la pluie, on se retourne vers une fenêtre allumée de l'étage où quelqu'un regarde (il
  disparaît à l'éclair ; c'est le patient lui-même, à la fenêtre de sa chambre, jamais dit), puis la grille, la route, un début d'aube. Pendant la marche, la santé mentale ne baisse plus, les
  effets de la maladie s'apaisent et le brouillard s'ouvre. Puis le réveil dans la chambre 104, et la **fiche de fin** : une
  fiche d'incident tapée ligne par ligne (heure, durée, hôpital quitté en + score du classement, appels, codes erronés,
  cachets, état mental à la sortie), la note du médecin de garde selon la partie (« … ses chaussures étaient trempées »),
  une évaluation de A à D et le tampon « SORTI ». Rattrapé ou perdu pied : un rapport d'incident (lieu, énigmes franchies,
  tampon « RÉINTÉGRÉ »). Les boutons Publier mon score et Classement restent sur la fiche. Options > Développeur > Terminer
  la partie : se place devant le portique et lance la fin.
- Vue de la fenêtre : le même extérieur que la fin (`fin.js` construit une seconde fois, tourné d'un demi-tour pour que
  la fenêtre allumée de la marche dehors tombe sur celle de la 104) : sous la fenêtre l'auvent et le perron, puis le
  parvis, l'allée jusqu'à la grille ouverte, la route et la ville. Pas de façade ni de guetteur dans cette copie, la pluie
  reste celle de `world.js`, et le brouillard ne s'y applique pas. La cantine du RDC (un étage, toit plat) est à droite :
  les arbres qui la traverseraient sont retirés (`keepOut` dans `main.js`). Quand il perd pied (au-delà de 45 %), un homme
  en pyjama sort de sous l'auvent et marche jusqu'à la grille (24 s, puis 40 à 75 s d'attente) : lui-même, une autre nuit.

## Fichiers
- `main.js` : joueur, interactions, téléphones, PC (calque net projeté sur l'écran 3D), panneaux (cadenas, planning), choix
  de dialogue, santé mentale, hallucinations, fins.
- `fin.js` : l'extérieur derrière le portique de sortie, la marche jusqu'à la route et la fiche de fin.
- `ambiance.js` : les voix entendues sans bloquer (haut-parleurs, ascenseur, ronde de Perrin, sécurité, autres patients).
- `histoire.js` : l'histoire (énigmes, codes, fichiers des archives, programme à corriger, planning, indices, emplacements) et
  les objets d'énigme provisoires faits en code.
- `shell.js` : lien avec le site autour du jeu (pseudo, compte, classement, publication du score, déconnexion), par `postMessage` ; le site peut couvrir le jeu
  (`clausus:cover`) : menus masqués, rien ne démarre avant qu'il se retire.
- `ui-kit.js` : l'interface commune des menus (boutons, onglets, panneaux, champs, voile, logo, textures peintes),
  partagée avec les écrans du site. `menu.js` s'en sert ; une modification s'applique aux deux.
- `world.js` : extérieur pluvieux (éclairs), vitre, feuille, photo et pièces.
- `os.js` : mini-OS MEDISYS dessiné sur canvas (texture de l'écran + interface interactive), deux postes : archives et sécurité.
- `touch.js` : commandes tactiles (joystick, regard, boutons, clavier du PC, détection, plein écran).
- `hands.js` : mains en première personne et poses animées (épaules liées à la vue, bras de 0,56 m ; `reachPose` dans `main.js`
  cherche la position, la hauteur des yeux et le regard d'où la main atteint ce qu'on utilise). `audio.js` : sons 100 % procéduraux (WebAudio).
- `motion.js` : le mouvement commun à toutes les animations et cinématiques : courbes d'accélération (`ease.reach` pour un
  geste, `ease.body` pour le corps, `ease.push`, `ease.fall`, `ease.outBack`…), bruit organique (`drift`, `noise`) à la place
  des sinus qui se répètent, et durées légèrement variables (`vary`) pour que deux gestes ne soient jamais identiques.
  Caméra scriptée (`camTo` : la tête tourne un peu avant le corps, trajet courbé par un point `via`, pas et balancement en
  marchant, inclinaison dans les virages, respiration à l'arrêt), mains (trajets en arc, poignet qui anticipe, doigts qui se
  ferment l'un après l'autre), portes de l'hôpital (inertie et petit rebond), PNJ (accélèrent, ralentissent, regards).
- `body.js` : pose à chaque image les deux corps du joueur (`player_body.glb`, difforme, qui ne porte que l'ombre, et
  `player_reflection.glb`, normal, que montrent les miroirs de `mirrors.js`) d'après la vue subjective : marche en avant
  comme en arrière (vrai cycle de pas : appui, déroulé du pied, poussée, jambe qui passe genou plié ; bassin qui monte,
  descend, se déporte et pivote ; bras en balancier en retard sur les jambes, course pour le patient qui poursuit ;
  hanches tournées vers un pas de côté, petits pas pour tourner sur place ; respiration et appui qui change à l'arrêt), accroupi quand le regard descend, assis au PC, allongé après l'effondrement ; la tête suit le regard,
  les bras rejoignent les poignets des mains en vue subjective dès qu'elles tiennent ou font quelque chose. La lampe torche
  ne projette pas l'ombre du corps. Quand la santé mentale baisse, le reflet joue la pose d'un instant plus tôt ; sous 30 %,
  sa tête ne suit plus et continue de fixer le joueur.
- `objets.js` : remplace les formes de départ du code par les modèles Blockbench (ascenseur, escalier, comptoir, encadrements, néons, torche, pièce, vue extérieure). Restent en code les effets et le contenu généré : pluie, poussière, cône de lumière, ciel, sol extérieur, vitre, cordon du téléphone, écran du PC, plaques et indicateurs, feuille et photo, coque et collisions.
- `hudscreen.js` : le HUD (barre, compteurs, réticule, indications, bulles) recopié du DOM sur un calque passé dans le même effet cathodique que l'image.
- `post.js` : shader final. `config.js` : tous les réglages (schéma unique). `menu.js` : menus.
- `hud/`, `ui/` : HUD, bulles de dialogue, logo et kit d'interface rendus depuis des modèles Blockbench (`blockbench/`).
- `decor.js` : pièce montée avec les modules de `assets/decor/` (voir ci-dessous).
- `props.js` : mobilier et objets de la chambre (`assets/props/`), leurs animations, interactions et états de délabrement.
- `assets/` : modèles .glb de l'équipe. `vendor/three` : Three.js r187 local.

## Décor modulaire
La chambre mesure 4 × 6 × 2,7 m, soit 2 × 3 modules de 2 m : aucun module n'est déformé. Chaque emplacement charge les 4 états
de sa variante (`wall_1a` à `wall_4a`) et n'en change que hors du champ de vision. Les choix d'emplacement sont dans `decor.js`.
Quatre murs portent une phrase à l'état 4 : ILS TE VOIENT, ILS ÉCOUTENT, MOUREZ, SORS. La fenêtre n'a qu'un état : son mur est
simplement assombri quand la pièce se dégrade.
Les sources `.bbmodel` de ces modèles ne sont pas dans ce dépôt. Réexporter une vitre depuis Blockbench perd son `alphaMode: BLEND`.

## Props de la chambre
Règles de fabrication de tout asset : [`blockbench/REGLES_ASSETS.md`](blockbench/REGLES_ASSETS.md) (elles priment sur `BRIEF.md`).
39 modèles Blockbench, dans `assets/props/` (sources `.bbmodel` dans `blockbench/props/`, générées par
`blockbench/gen/props_*.py` ; conventions dans `blockbench/props/BRIEF.md`). Aperçus PNG dans `preview/`, planche complète :
`preview/_planche.png`. Regénérer un groupe : `cd blockbench/gen && python3 props_mobilier.py [noms…]` (idem `props_medical`,
`props_archi`, `props_perso`, `props_decay`). L'export `.glb` passe par `bb2glb` (web app Blockbench en Chromium headless).
- **Toujours là** : table de chevet + plateau-repas, rangement sans portes (la blouse bouge quand la santé mentale baisse),
  lavabo, miroir inox, WC inox, gobelet à brosse à dents, radiateur sous la fenêtre, pied à perfusion, chaussons, pilulier,
  gobelet doseur, bracelet, carnet et doudou sur le lit, feuille de soins, pile de livres, dessins d'enfant.
- **Au mur et au plafond** : bouton d'appel infirmier (à gauche de la table de chevet), interrupteur à clé, horloge (part de 03:17 comme celle du HUD, saccade puis tourne à
  l'envers quand la santé mentale baisse), bouche d'aération (chuchotements), détecteur de fumée (LED), caméra en dôme
  (balaie la pièce, puis suit le joueur), hublot et passe-plat sur la porte (le volet claque tout seul).
- **Délabrement** (même règle que les murs : un prop ne change que hors du champ de vision) : sangles du lit (rangées →
  ouvertes → bouclées sur un lit vide → arrachées), couverture qui glisse puis change de place, tache au plafond, seau
  et flaque, griffures, empreintes de mains autour de la photo, gravats, matelas au sol puis éventré (une pièce cachée dans
  la mousse), poupée dont la tête se tourne vers le joueur quand il ne la regarde pas, fauteuil roulant, dessins corrompus,
  eau noire dans les WC.
- **Interactions** : appeler l'infirmière, ouvrir le pilulier, se regarder dans le miroir, regarder les dessins, lire la
  feuille de soins, le bracelet, le carnet, l'interrupteur, fouiller le matelas éventré.

### PNJ

Les six modèles de `modeles/personnages/` sont copiés dans `assets/` et chargés par `pnj.js` :
infirmière à l'accueil (`nurse`), infirmier au poste de sécurité, médecins dans les cabinets 005 et 006,
patients dans les chambres 102 et 101. Chaque PNJ utilise son propre `PlayerBody`, marche autour de son poste,
regarde le joueur à proximité et propose une interaction « Parler ». L'infirmière reprend le dialogue
à choix de l'arrivée au rez-de-chaussée ; le personnel reconnaît le joueur sans blouse.
L’infirmière d’accueil et les médecins n’apparaissent qu’une fois la blouse portée ; avant cela, ils ne se déplacent pas, ne bloquent pas le passage et ne proposent aucune interaction. Le garde et les patients restent présents. Une sauvegarde avec la blouse les rend visibles dès le chargement.
Les PNJ effectuent de courtes rondes dans leur pièce, sur des trajets contrôlés contre les murs, les portes et le mobilier. Ils s’arrêtent près du joueur pour parler ; leur collision suit leur position. Ils restent à leur étage et ne franchissent pas les portes des énigmes. Le jeu est uniquement en français. Les modèles sont aussi accessibles dans `window.__clausus.npcs.actors`.
Exception : le garde (`orderly_male`) attend près de l’escalier du RDC sans intercepter automatiquement le joueur sans blouse. Parler directement au garde sans blouse déclenche toujours la capture. Une fois la blouse portée, il parcourt en boucle les quatre couloirs du RDC, le hall et l’accueil, avec des pauses aux points de passage. Il s’arrête près du joueur et devant les obstacles, sans entrer dans les salles ni changer d’étage. À l’accueil, avouer à l’infirmière ne pas être médecin déclenche son appel à la sécurité, puis la scène du sédatif.
Il s’affiche comme « AGENT DE SÉCURITÉ » et charge le modèle dédié `security_guard` (uniforme bleu nuit, badge et marquage sécurité). L’interception fait venir un intervenant médical depuis un passage proche vérifié libre : `treatment.js` anime sa marche puis son bras avec une seringue avant la réplique sur le sédatif. La caméra cadre le geste. Si aucun passage sûr n’est disponible ou si l’approche reste bloquée, le personnel raccompagne le joueur sans annoncer d’injection.

### Affiches hospitalières
Cinq séries (hygiène, silence, traitement, orientation, annuaire), chacune avec quatre modèles Blockbench :
`blockbench/props/affiche_{theme}_{1..4}.bbmodel`, textures pixel art dessinées dans `blockbench/props/tex/`,
exports `assets/props/affiche_{theme}_{1..4}.glb`. Le script `blockbench/gen/affiches.py` crée les textures,
construit les feuilles à huit faces dans Blockbench via son MCP local (port 3100), puis exporte les GLB.
Aucun service de génération d'image. Les derniers états ont un coin de papier légèrement soulevé.

`hopital/affiches.js` les pose sur les portions pleines des murs des espaces communs, à 1,75 m du sol,
espacées d'au moins 7 m par étage. Elles utilisent les paliers du décor : santé mentale au-dessus de 70 %,
puis 45 %, puis 22 %, puis état final. Le changement et le retour à un état plus calme se font hors du
champ de vision, via les mêmes tuiles que les murs. Aucun indice ni plan d'évacuation n'est modifié.

Les séries orientation et annuaire donnent des fausses pistes après le premier palier : une sortie à l’étage
(puis dans la chambre 104), et le Dr Hélène Morel comme référente/détentrice des clés, au lieu du vrai
référent indiqué par le dossier patient. L’état initial invite à passer à l’accueil ou consulter le dossier.
Ces affiches sont purement visuelles ; elles ne changent ni les vrais documents, ni les codes, ni les objectifs.
La main de la série silence comporte un index dressé, trois doigts repliés, un pouce et un poignet.

### Psychiatre — Dr William Morel

Dans le cabinet 007, le dictaphone posé à côté du coffret permet de choisir et réécouter
six notes (admission du patient 27 en chambre 104, traitement, Léa, appels nocturnes,
téléphones et retour devant le portique). Cette consultation est facultative.
Les textes suivent la fiche de doublage actuelle, dans `morel.js`.

Pendant les hallucinations, Morel peut chuchoter à partir de 50 % de santé mentale
perdue, avec au moins 45 secondes entre deux interventions. Sa remarque sur la blouse
nécessite de la porter ; « Tu n’as jamais eu de fille » nécessite 85 % de perte.
Ces interventions ne bloquent pas le joueur.

Les enregistrements actuels sont **à fournir** : `assets/audio/voix/MOR_D01.mp3`
à `MOR_D06.mp3` et `MOR_H01.mp3` à `MOR_H06.mp3`. Ils seront chargés avant leur
première lecture, sur le volume Voix ; les notes se mettent en pause avec le menu,
et passer à la suite arrête leur lecture. Sans fichier, le texte reste disponible.
L’enregistrement Valmont de l’ancienne fiche n’est pas utilisé.
