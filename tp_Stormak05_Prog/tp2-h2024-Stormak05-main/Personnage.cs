using System;
using System.Media;
using System.Collections.Generic;
using System.Linq;
using System.Net.Security;
using System.Text;
using System.Threading.Tasks;

namespace TP2_ME
{
     public abstract class Personnage
    {
        protected byte arm;
        protected byte coolDownPouvoir;
        protected string criCritique;
        protected string criDebut;
        protected string criDefaite;
        protected string criVictoire;
        protected byte def;
        protected Personnage ennemi;
        protected byte mat;
        protected string nom;
        protected bool pouvoirUtilise = false;
        protected byte pow;
        private byte PTS_DE_VIES;
        protected byte ptsVie = 20;
        protected Random random = new Random();
        De de1 = new De();
        De de2 = new De();

        /// <summary>
        /// Constructeur de la classe <c>Personnage</c>.
        /// Initialise les caractéristiques de base du personnage.
        /// </summary>
        /// <param name="nom">Le nom du personnage.</param>
        /// <param name="mat">La valeur de l'attaque du personnage.</param>
        /// <param name="def">La valeur de défense du personnage.</param>
        /// <param name="arm">La valeur de l'armure du personnage.</param>
        /// <param name="pow">La valeur du pouvoir du personnage.</param>
        public Personnage(string nom, byte mat, byte def, byte arm, byte pow)
        {
            this.nom = nom;
            this.mat = mat;
            this.def = def;
            this.arm = arm;
            this.pow = pow;
        }
        /// <summary>
        /// 
        /// </summary>
        /// <returns>Retourne l'ennemi</returns>
        public Personnage getEnnemi()
        {
            return ennemi;
        }

        public void setEnnemi(Personnage ennemi)
        {
            this.ennemi = ennemi;
        }
        /// <summary>
        /// Vérifie si l'attaque est critique
        /// </summary>
        /// <returns>retourne les 2 des si identiques</returns>
        public bool attaqueEstCritique()
        {
            return de1.getValeur() == de2.getValeur();
        }
        /// <summary>
        /// La fonction attaque
        /// </summary>
        /// <returns></returns>
        public int attaque()
        {
            int totalDes = de1.brasser() + de2.brasser() + mat;
            Console.WriteLine($"Attaque : {totalDes}");
            return totalDes;
        }
        /// <summary>
        /// Augmente la mat
        /// </summary>
        public void augmenterMat()
        {
            mat += 1;
            Console.WriteLine($"Votre mat a augmenté de 1. Nouvelle valeur : {mat}");
        }
        /// <summary>
        /// Verifie si critique effectue le cri
        /// </summary>
        protected void critique()
        {
            Console.WriteLine($"{nom} effectue une attaque critique !");
        }
        /// <summary>
        /// cri du debut de combat
        /// </summary>
        protected void debutCombat()
        {
            Console.WriteLine($"Le combat commence avec {nom} ! {criDebut}");
        }
        /// <summary>
        /// diminue l'arn
        /// </summary>
        public void diminuerArm()
        {
            arm -= 1;
            Console.WriteLine($"Votre arm a diminué de 1. Nouvelle valeur : {arm}");
        }

        public void diminuerCoolDownPouvoir()
        {
            coolDownPouvoir--;
        }

        public void diminuerDef()
        {
            def -= 1;
            Console.WriteLine($"Votre def a diminué de 1. Nouvelle valeur : {def}");
        }

        public void diminuerMat()
        {
            mat -= 1;
            Console.WriteLine($"Votre mat a diminué de 1. Nouvelle valeur : {mat}");
        }

        private void enleverPointsVies(int dommage)
        {
            ptsVie -= (byte)dommage;
            if (ptsVie < 0)
                ptsVie = 0;
        }

        public bool estPouvoirUtilise()
        {
            return pouvoirUtilise;
        }

        public abstract void FinPouvoir();

        public void gagner()
        {
            Console.WriteLine($"{nom} a gagné !");
        }
        /// <summary>
        /// Fonction pour generer des dommages
        /// </summary>
        /// <returns></returns>
        public int genererDommage()
        {
            int de1 = random.Next(1, 7);
            int de2 = random.Next(1, 7);

            int dommageTotal = de1 + de2 + attaque();

            if (de1 == de2)
            {
                dommageTotal *= 2;
                Console.WriteLine($"L'attaque de {nom} est critique !");
            }

            return dommageTotal;
        }

        public byte getArm()
        {
            return this.arm;
        }

        public byte getCoolDownPouvoir()
        {
            return this.coolDownPouvoir;
        }

        public byte getdef()
        {
            return def;
        }

        public string getEtat()
        {
            return $"{nom} - Points de vie : {ptsVie}, Armure : {arm}, Attaque : {attaque}, Défense : {def}";
        }

        public string getNom()
        {
            return nom;
        }

        public byte getPtsVies()
        {
            return ptsVie;
        }

        protected void mourir()
        {
            Console.WriteLine($"{nom} est mort...");
        }

        public void retablirArm()
        {
            arm++;
            Console.WriteLine($"L'armure de {nom} a été rétablie !");
        }

        public void retablirDef()
        {
            def++;
            Console.WriteLine($"La défense de {nom} a été rétablie !");
        }

        public void retabliMat()
        {
            mat++;
            Console.WriteLine($"La capacité d'attaque de {nom} a été rétablie !");
        }

        public void souffrir(int dommage)
        {
            int ptsViesPerdus = (byte)ptsVie - (dommage);
            ptsVie -= (byte)dommage;
            if (ptsVie <= 0)
            {
                ptsVie = 0;
                mourir();
            }
            else
            {
                Console.WriteLine($"{nom} a subi {dommage} points de dommages !");
            }
        }

        public abstract void UtiliserPouvoir();

        public void AfficherStats()
        {
            Console.WriteLine($"{nom} le {this.GetType().Name}");
            Console.WriteLine($"Points de vie : {ptsVie}, Armure : {arm}, Défense : {def}, Attaque : {mat}");
        }


    }

}

