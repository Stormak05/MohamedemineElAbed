using System;
using System.Media;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TP2_ME
{
    public class Barbare : Personnage
    {
        private byte ARM;
        private string CRI_ATTAQUE;
        private string CRI_DEBUT;
        private string CRI_DEFAITE;
        private string CRI_VICTOIRE;
        private byte DEF;
        private byte MAT;
        private byte POW;

        /// <summary>
        /// Déclaration des variables et notamment des sons du Barbare.
        /// </summary>
        /// <param name="nom"></param>
        public Barbare(string nom) : base(nom, 9,12,16,12)
        {
            CRI_ATTAQUE = "\\sons\\critiqueBarbare.wav";
            CRI_DEBUT = "\\sons\\barbareintro.wav";
            CRI_DEFAITE = "\\sons\\barbareMort.wav";
            CRI_VICTOIRE = "\\sons\\barbarewin.wav";
            MAT = 9;
            DEF = 12;
            ARM = 16;
            POW = 12;
            ARM = 1;
        }

        /// <summary>
        /// 
        /// </summary>
        public void finPouvoir()
        {
            DEF += 1;
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
        

        /// <summary>
        /// 
        /// </summary>
        public override void FinPouvoir()
        {
            if (pouvoirUtilise)
            {
                pouvoirUtilise = false;
                augmenterMat();
                Console.WriteLine("Le pouvoir spécial du Barbare se dissipe !");
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
                diminuerMat();
                Console.WriteLine("Le Barbare rugit, intimidant son adversaire !");
            }
            else
            {
                Console.WriteLine("Le Barbare a déjà utilisé son pouvoir spécial !");
            }
        }

    }
}
