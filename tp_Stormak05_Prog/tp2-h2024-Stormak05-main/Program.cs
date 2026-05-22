namespace TP2_ME
{
    internal class Program
    {
            static void Main(string[] args)
            {

                // Démarrage du jeu
                HeroesOfMatane jeu = new HeroesOfMatane();
                jeu.gererTourJeu();

                // Boucle pour gérer les tours de jeu jusqu'à ce que la partie soit terminée
                while (!jeu.estPartieTerminee())
                {
                    jeu.gererAttaqueJoueurActif(); // Gérer l'attaque du joueur actif
                    jeu.changerJoueurActif(); // Passer au joueur suivant
                }

                // Affichage du message de fin de partie
                Console.WriteLine("Partie terminée ! Appuyez sur n'importe quelle touche pour quitter.");
                Console.ReadKey();
            }
    }
}
