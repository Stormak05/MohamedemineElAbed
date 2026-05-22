using System;
using System.Media;
using System.Collections.Generic;
using System.Linq;
using System.Net.Quic;
using System.Text;
using System.Threading.Tasks;

namespace TP2_ME
{
    public class HeroesOfMatane
    {
        private Personnage persoJoueur1;
        private Personnage persoJoueur2;
        private string joueurActif;

        /// <summary>
        /// Constructeur de la classe <c>HeroesOfMatane</c>.
        /// Initialise les personnages des deux joueurs.
        /// </summary>
        /// <param name="nomJoueur1">Le nom du premier joueur.</param>
        /// <param name="nomJoueur2">Le nom du deuxième joueur.</param>
        public HeroesOfMatane(string nomJoueur1, string nomJoueur2)
        {
            persoJoueur1 = CreerPerso(nomJoueur1);
            persoJoueur2 = CreerPerso(nomJoueur2);
            joueurActif = nomJoueur1;
        }
        /// <summary>
        /// Constructeur par défaut de la classe <c>HeroesOfMatane</c>.
        /// </summary>
        public HeroesOfMatane()
        {
        }
        /// <summary>
        /// Méthode permettant de démarrer une partie.
        /// Affiche un message de bienvenue, gère les tours de jeu jusqu'à la fin de la partie
        /// et annonce le gagnant à la fin.
        /// </summary>
        public void DemarrerPartie()
        {
            Console.WriteLine("Bienvenue dans Heroes of Matane !");
            Console.WriteLine("---------------------------------");
            Console.WriteLine($"Combat entre {persoJoueur1.getNom()} le {persoJoueur1.GetType().Name} et {persoJoueur2.getNom()} le {persoJoueur2.GetType().Name} !");
            Console.WriteLine("---------------------------------");

            while (!EstPartieTerminee())
            {
                GererTourJoueur();
                ChangerJoueurActif();
            }

            Console.WriteLine("Fin du combat !");
            Console.WriteLine($"Le gagnant est {(persoJoueur1.getPtsVies() <= 0 ? persoJoueur2.getNom() : persoJoueur1.getNom())} !");
            /*Console.WriteLine($"Cri de victoire : {(persoJoueur1.getPtsVies() <= 0 ? persoJoueur2.CRI_VICTOIRE : persoJoueur1.CriDeVictoire())} !");
            Console.WriteLine($"Cri de défaite : {(persoJoueur1.getPtsVies() <= 0 ? persoJoueur1.CriDeDefaite() : persoJoueur2.CriDeDefaite())} !");*/
        }
        /// <summary>
        /// Méthode privée pour créer un personnage en fonction du choix de l'utilisateur.
        /// </summary>
        /// <param name="nom">Le nom du personnage.</param>
        /// <returns>Le personnage créé.</returns>
        private Personnage CreerPerso(string nom)
        {
            Console.WriteLine("Choisissez votre héros :");
            Console.WriteLine("Barbare : 1\nPaladin : 2\nSorcier : 3\nFéticheur : 4");
            Console.Write("Choix : ");
            int choixClassePersonnage = Convert.ToInt32(Console.ReadLine());

            switch (choixClassePersonnage)
            {
                case 1:
                    return new Barbare(nom); // Exemple de valeurs, à adapter
                case 2:
                    return new Paladin(nom); // Exemple de valeurs, à adapter
                case 3:
                    return new Sorcier(nom); // Exemple de valeurs, à adapter
                case 4:
                    return new Feticheur(nom); // Exemple de valeurs, à adapter
                default:
                    throw new ArgumentException("Classe invalide.");
            }
        }
        /// <summary>
        /// Méthode privée pour gérer le tour d'un joueur.
        /// Affiche les options d'attaque et traite le choix de l'utilisateur.
        /// </summary>
        private void GererTourJoueur()
        {
            Console.WriteLine($"C'est au tour de {joueurActif} le {LireChoixHeros()}");
            Console.WriteLine("Attaque normale : 1\nAttaque spéciale : 2");
            Console.Write("Choix : ");
            int choixAttaque = Convert.ToInt32(Console.ReadLine());

            switch (choixAttaque)
            {
                case 1:
                    GererAttaqueJoueurActif();
                    break;
                case 2:
                    GererAttaqueSpecialeJoueurActif();
                    break;
                default:
                    Console.WriteLine("Choix invalide. Veuillez choisir une attaque valide.");
                    break;
            }
        }
        /// <summary>
        /// Méthode privée pour gérer l'attaque du joueur actif.
        /// </summary>
        private void GererAttaqueJoueurActif()
        {
            Personnage attaquant = joueurActif == persoJoueur1.getNom() ? persoJoueur1 : persoJoueur2;
            Personnage defenseur = joueurActif == persoJoueur1.getNom() ? persoJoueur2 : persoJoueur1;

            int totalAttaque = attaquant.attaque();

            Console.WriteLine($"Attaque : {totalAttaque}");
            Console.WriteLine($"Def : {defenseur.getdef()}");

            if (totalAttaque >= defenseur.getdef())
            {
                int dommages = attaquant.genererDommage();
                defenseur.souffrir(dommages);
                Console.WriteLine($"Dommages : {dommages}");
            }
            else
            {
                Console.WriteLine("Attaque manquée !");
            }

            attaquant.AfficherStats();
            defenseur.AfficherStats();
        }
        /// <summary>
        /// Méthode privée pour gérer l'attaque spéciale du joueur actif.
        /// </summary>
        private void GererAttaqueSpecialeJoueurActif()
        {
            Console.WriteLine("Attaque spéciale : 1");
            Console.Write("Choix : ");
            string choix = Console.ReadLine();

            if (choix == "1")
            {
                // Implémentez ici la logique de l'attaque spéciale du joueur actif
            }
            else
            {
                Console.WriteLine("Choix invalide. Veuillez choisir une attaque spéciale valide.");
            }
        }
        /// <summary>
        /// Méthode privée pour changer le joueur actif.
        /// </summary>
        private void ChangerJoueurActif()
        {
            joueurActif = joueurActif == persoJoueur1.getNom() ? persoJoueur2.getNom() : persoJoueur1.getNom();
        }
        /// <summary>
        /// Méthode privée pour vérifier si la partie est terminée.
        /// </summary>
        /// <returns>True si la partie est terminée, False sinon.</returns>
        private bool EstPartieTerminee()
        {
            return persoJoueur1.getPtsVies() <= 0 || persoJoueur2.getPtsVies() <= 0;
        }
        /// <summary>
        /// Méthode privée pour lire le choix du héros du joueur actif.
        /// </summary>
        /// <returns>Le nom du héros choisi.</returns>
        private string LireChoixHeros()
        {
            return joueurActif == persoJoueur1.getNom() ? persoJoueur1.GetType().Name : persoJoueur2.GetType().Name;
        }
    }
}
