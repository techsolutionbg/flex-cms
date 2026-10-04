<?php

declare(strict_types=1);

require dirname(__DIR__) . '/vendor/autoload.php';

use Flex\Updates\Remote\RemoteCatalogPublication;

[$script, $catalogPath, $entryPath, $outputPath, $keyPath] = $argv;
$catalog = json_decode(file_get_contents($catalogPath), true, 512, JSON_THROW_ON_ERROR);
$entry = json_decode(file_get_contents($entryPath), true, 512, JSON_THROW_ON_ERROR);
$privateKey = base64_decode(trim(file_get_contents($keyPath)), true);
$publicKey = base64_encode(sodium_crypto_sign_publickey_from_secretkey($privateKey));
$catalog = RemoteCatalogPublication::merge($catalog, $entry, $publicKey);
file_put_contents($outputPath, json_encode($catalog, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
