using System;
using System.Media;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Numerics;

namespace TP2_ME
{
  
    public class Sorcier : Personnage
    {
        private byte ARM;
        private string CRI_ATTAQUE;
        private string CRI_DEBUT;
        private string CRI_DEFAITE;
        private string CRI_VICTOIRE;
        private byte DEF;
        private byte MAT;
        private byte POW;
        private bool pouvoirActif;

        /// <summary>
        /// Déclaration des variables et notamment des sons du Sorcier.
        /// </summary>
        /// <param name="nom"></param>
        public Sorcier(string nom) : base(nom, 6, 15, 13, 12)
        {
            CRI_ATTAQUE = "\\sons\\critiqueSorcier.wav";
            CRI_DEBUT = "\\sons\\sorcierintro.wav";
            CRI_DEFAITE = "\\sons\\sorcierMort.wav";
            CRI_VICTOIRE = "\\sons\\sorcierwin.wav";
            MAT = 6;
            DEF = 15;
            ARM = 13;
            POW = 12;
            pouvoirActif = false;

        }
        
        /// <summary>
        /// 
        /// </summary>
        public void finPouvoir()
        {
            DEF += 1;
            pouvoirActif = false;
            Console.WriteLine("Pouvoir spécial du Sorcier terminé. La défense est restaurée.");
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="nom"></param>
        /// <returns></returns>
        public string getNom(string nom)
        {
            return nom;
        }

        /// <summary>
        /// 
        /// </summary>
        public void retablirArm()
        {
            ARM = 13; // Rétablir l'armure du Sorcier
            Console.WriteLine("L'armure du Sorcier est rétablie !");
        }

        /// <summary>
        /// 
        /// </summary>

        public void retablirDef()
        {
            DEF = 15; // Rétablir la défense du Sorcier
            Console.WriteLine("La défense du Sorcier est rétablie !");
        }

        /// <summary>
        /// 
        /// </summary>

        public void retablirMat()
        {
            MAT = 6; // Rétablir la capacité d'attaque du Sorcier
            Console.WriteLine("La capacité d'attaque du Sorcier est rétablie !");
        }

        /// <summary>
        /// 
        /// </summary>
        public void utiliserPouvoir()
        {
            if (!pouvoirActif)
            {
                DEF -= 1;
                pouvoirActif = true;
                Console.WriteLine("Le Sorcier utilise son pouvoir pour affaiblir l'ennemi !");
            }
            else
            {
                Console.WriteLine("Le Sorcier a déjà utilisé son pouvoir spécial !");
            }
        }

        /// <summary>
        /// 
        /// </summary>
        public override void FinPouvoir()
        {
            if (pouvoirUtilise)
            {
                pouvoirUtilise = false;
                retablirDef();
                Console.WriteLine("Le pouvoir spécial du Sorcier se dissipe !");
            }
        }

        /// <summary>
        /// 
        /// </summary>
        public override void UtiliserPouvoir()
        {
            if (!pouvoirUtilise)
            {
                pouvoirUtilise = true;
                diminuerDef();
                Console.WriteLine("Le Sorcier lance un sort de froid, engourdissant son adversaire !");
            }
            else
            {
                Console.WriteLine("Le Sorcier a déjà utilisé son pouvoir spécial !");
            }
        }

    }
}
