using System;
using System.Media;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TP2_ME
{
    public class Paladin : Personnage
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
        /// Déclaration des variables et notamment des sons du Paladin.
        /// </summary>
        /// <param name="nom"></param>
        public Paladin(string nom) : base(nom, 8, 16, 12, 12)
        {
            CRI_ATTAQUE = "\\sons\\critiquePaladin.wav";
            CRI_DEBUT = "\\sons\\paladinintro.wav";
            CRI_DEFAITE = "\\sons\\paladinMort.wav";
            CRI_VICTOIRE = "\\sons\\paladinwin.wav";
            MAT = 8;
            DEF = 16;
            ARM = 12;
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
        public void utiliserPouvoir()
        {
            DEF -= 1;
            Console.WriteLine("Le Sorcier utilise son pouvoir pour affaiblir l'ennemi !");
        }

        /// <summary>
        /// 
        /// </summary>
        public override void FinPouvoir()
        {
            if (pouvoirUtilise)
            {
                pouvoirUtilise = false;
                diminuerMat();
                Console.WriteLine("Le pouvoir spécial du Paladin se dissipe !");
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
                augmenterMat();
                Console.WriteLine("Le Paladin entre en rage, augmentant sa force !");
            }
            else
            {
                Console.WriteLine("Le Paladin a déjà utilisé son pouvoir spécial !");
            }
        }
    }
}
