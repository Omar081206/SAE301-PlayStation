<?php

declare(strict_types=1);

namespace App\Model;

use PDO;

/**
 * Accès aux comptes utilisateurs.
 *
 * Cette couche ne contient aucune règle métier et ne décide de rien : elle
 * ne vérifie pas les mots de passe, elle range et retrouve des empreintes.
 */
final class UtilisateurModel
{
    /** Connexion à la base, fournie à la construction. */
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * Un compte par son adresse e-mail, ou null s'il n'existe pas. La
     * collation de la table ne distingue pas la casse.
     *
     * @return array<string, mixed>|null
     */
    public function trouverParEmail(string $email): ?array
    {
        $requetePreparee = $this->pdo->prepare(
            'SELECT id, email, prenom, nom, mot_de_passe, role FROM utilisateur WHERE email = :email'
        );
        $requetePreparee->bindValue(':email', $email, PDO::PARAM_STR);
        $requetePreparee->execute();

        return $this->compte($requetePreparee->fetch());
    }

    /**
     * Un compte par son identifiant, ou null s'il n'existe pas.
     *
     * @return array<string, mixed>|null
     */
    public function trouverParId(int $id): ?array
    {
        $requetePreparee = $this->pdo->prepare(
            'SELECT id, email, prenom, nom, mot_de_passe, role FROM utilisateur WHERE id = :id'
        );
        $requetePreparee->bindValue(':id', $id, PDO::PARAM_INT);
        $requetePreparee->execute();

        return $this->compte($requetePreparee->fetch());
    }

    /**
     * Ligne lue en base, convertie (MySQL renvoie des chaînes), ou null.
     *
     * @param array<string, mixed>|false $ligne
     * @return array<string, mixed>|null
     */
    private function compte(array|false $ligne): ?array
    {
        if ($ligne === false) {
            return null;
        }

        return [
            'id'           => (int) $ligne['id'],
            'email'        => $ligne['email'],
            'prenom'       => $ligne['prenom'],
            'nom'          => $ligne['nom'],
            'mot_de_passe' => $ligne['mot_de_passe'],
            'role'         => $ligne['role'],
        ];
    }

    /**
     * Vrai si le compte existe toujours (une session peut survivre à la
     * suppression de son compte, par exemple après une réimportation).
     */
    public function existe(int $id): bool
    {
        $requetePreparee = $this->pdo->prepare('SELECT 1 FROM utilisateur WHERE id = :id');
        $requetePreparee->bindValue(':id', $id, PDO::PARAM_INT);
        $requetePreparee->execute();

        return $requetePreparee->fetchColumn() !== false;
    }

    /**
     * Crée un compte client et renvoie son identifiant.
     *
     * @param string $empreinte Empreinte du mot de passe (password_hash), jamais
     *                          le mot de passe lui-même.
     */
    public function creer(string $email, string $prenom, string $nom, string $empreinte): int
    {
        $requetePreparee = $this->pdo->prepare(
            "INSERT INTO utilisateur (email, prenom, nom, mot_de_passe, role)
             VALUES (:email, :prenom, :nom, :empreinte, 'client')"
        );
        $requetePreparee->bindValue(':email',     $email,     PDO::PARAM_STR);
        $requetePreparee->bindValue(':prenom',    $prenom,    PDO::PARAM_STR);
        $requetePreparee->bindValue(':nom',       $nom,       PDO::PARAM_STR);
        $requetePreparee->bindValue(':empreinte', $empreinte, PDO::PARAM_STR);
        $requetePreparee->execute();

        return (int) $this->pdo->lastInsertId();
    }

    /**
     * Remplace le prénom, le nom et l'adresse e-mail d'un compte.
     */
    public function modifierProfil(int $id, string $prenom, string $nom, string $email): void
    {
        $requetePreparee = $this->pdo->prepare(
            'UPDATE utilisateur SET prenom = :prenom, nom = :nom, email = :email WHERE id = :id'
        );
        $requetePreparee->bindValue(':prenom', $prenom, PDO::PARAM_STR);
        $requetePreparee->bindValue(':nom',    $nom,    PDO::PARAM_STR);
        $requetePreparee->bindValue(':email',  $email,  PDO::PARAM_STR);
        $requetePreparee->bindValue(':id',     $id,     PDO::PARAM_INT);
        $requetePreparee->execute();
    }

    /**
     * Remplace l'empreinte du mot de passe d'un compte.
     *
     * @param string $empreinte Empreinte (password_hash), jamais le mot de passe.
     */
    public function modifierMotDePasse(int $id, string $empreinte): void
    {
        $requetePreparee = $this->pdo->prepare('UPDATE utilisateur SET mot_de_passe = :empreinte WHERE id = :id');
        $requetePreparee->bindValue(':empreinte', $empreinte, PDO::PARAM_STR);
        $requetePreparee->bindValue(':id',        $id,        PDO::PARAM_INT);
        $requetePreparee->execute();
    }
}
