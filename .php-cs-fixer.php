<?php

declare(strict_types=1);

$finder = PhpCsFixer\Finder::create()
    ->in([__DIR__ . '/bin', __DIR__ . '/config', __DIR__ . '/contracts', __DIR__ . '/database', __DIR__ . '/public', __DIR__ . '/src', __DIR__ . '/tests'])
    ->name('*.php')
    ->notPath('public/build');

return (new PhpCsFixer\Config())
    ->setRiskyAllowed(true)
    ->setRules([
        '@PER-CS2.0' => true,
        'declare_strict_types' => true,
        'ordered_imports' => true,
        'no_unused_imports' => true,
    ])
    ->setFinder($finder);
