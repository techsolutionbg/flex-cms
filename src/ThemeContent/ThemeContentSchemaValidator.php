<?php

declare(strict_types=1);

namespace Flex\ThemeContent;

/** Validates Theme Content Schema v1 manifest and field definition files. */
final class ThemeContentSchemaValidator
{
    private const FIELD_TYPES = ['text', 'textarea', 'checkbox', 'url', 'email', 'number', 'media', 'page_link', 'select', 'color', 'button_style', 'repeater'];

    private const ID_PATTERN = '/^[a-z][a-z0-9_-]{0,63}$/';

    /**
     * @param array<string, mixed> $manifest
     * @return list<string>
     */
    public function validateManifest(array $manifest, string $baseDirectory): array
    {
        $errors = [];
        if (($manifest['schema_version'] ?? null) !== 1) {
            $errors[] = 'schema_version must be 1.';
        }
        if (isset($manifest['layouts']) && !is_array($manifest['layouts'])) {
            $errors[] = 'layouts must be an array when set.';
        }
        if (!is_array($manifest['global'] ?? null)) {
            $errors[] = 'global must be an object with file and label.';
        } else {
            $errors = [...$errors, ...$this->validateFileRef($manifest['global'], 'global', $baseDirectory)];
        }
        if (isset($manifest['pages']) && !is_array($manifest['pages'])) {
            $errors[] = 'pages must be an array when set.';
        }
        $pageBindingIds = [];
        $claimedPageIds = [];
        $claimedSlugs = [];
        if (is_array($manifest['pages'] ?? null)) {
            foreach ($manifest['pages'] as $index => $pageBinding) {
                if (!is_array($pageBinding)) {
                    $errors[] = sprintf('pages[%d] must be an object.', $index);
                    continue;
                }
                $id = $pageBinding['id'] ?? null;
                if (!is_string($id) || preg_match(self::ID_PATTERN, $id) !== 1) {
                    $errors[] = sprintf('pages[%d].id is invalid.', $index);
                    continue;
                }
                if (isset($pageBindingIds[$id])) {
                    $errors[] = sprintf('Duplicate page binding id "%s".', $id);
                }
                $pageBindingIds[$id] = true;
                $errors = [...$errors, ...$this->validateFileRef($pageBinding, sprintf('pages[%d]', $index), $baseDirectory)];
                $errors = [...$errors, ...$this->validatePageBindingMatch($pageBinding, sprintf('pages[%d]', $index), $claimedPageIds, $claimedSlugs)];
                if (isset($pageBinding['layout']) && (!is_string($pageBinding['layout']) || preg_match(self::ID_PATTERN, $pageBinding['layout']) !== 1)) {
                    $errors[] = sprintf('pages[%d].layout must be a valid id when set.', $index);
                }
                if (array_key_exists('merge', $pageBinding) && !is_bool($pageBinding['merge'])) {
                    $errors[] = sprintf('pages[%d].merge must be a boolean when set.', $index);
                }
            }
        }
        $layoutIds = [];
        if (is_array($manifest['layouts'] ?? null)) {
            foreach ($manifest['layouts'] as $index => $layout) {
                if (!is_array($layout)) {
                    $errors[] = sprintf('layouts[%d] must be an object.', $index);
                    continue;
                }
                $id = $layout['id'] ?? null;
                if (!is_string($id) || preg_match(self::ID_PATTERN, $id) !== 1) {
                    $errors[] = sprintf('layouts[%d].id is invalid.', $index);
                    continue;
                }
                if (isset($layoutIds[$id])) {
                    $errors[] = sprintf('Duplicate layout id "%s".', $id);
                }
                $layoutIds[$id] = true;
                $errors = [...$errors, ...$this->validateFileRef($layout, sprintf('layouts[%d]', $index), $baseDirectory)];
                if (isset($layout['template']) && (!is_string($layout['template']) || trim($layout['template']) === '')) {
                    $errors[] = sprintf('layouts[%d].template must be a non-empty string when set.', $index);
                }
            }
        }

        return $errors;
    }

    /**
     * @param array<string, mixed> $definition
     * @return list<string>
     */
    public function validateSectionsFile(array $definition, string $contextLabel): array
    {
        $errors = [];
        if (!is_array($definition['sections'] ?? null)) {
            return ['sections must be an array in ' . $contextLabel . '.'];
        }
        $sectionIds = [];
        foreach ($definition['sections'] as $index => $section) {
            if (!is_array($section)) {
                $errors[] = sprintf('%s sections[%d] must be an object.', $contextLabel, $index);
                continue;
            }
            $id = $section['id'] ?? null;
            if (!is_string($id) || preg_match(self::ID_PATTERN, $id) !== 1) {
                $errors[] = sprintf('%s sections[%d].id is invalid.', $contextLabel, $index);
                continue;
            }
            if (isset($sectionIds[$id])) {
                $errors[] = sprintf('%s duplicate section id "%s".', $contextLabel, $id);
            }
            $sectionIds[$id] = true;
            if (!is_string($section['label'] ?? null) || trim((string) $section['label']) === '') {
                $errors[] = sprintf('%s section "%s" requires label.', $contextLabel, $id);
            }
            if (array_key_exists('page_slug', $section) && (!is_string($section['page_slug']) || preg_match(self::ID_PATTERN, $section['page_slug']) !== 1)) {
                $errors[] = sprintf('%s section "%s" page_slug must be a valid page slug when set.', $contextLabel, $id);
            }
            if (array_key_exists('page_role', $section) && $section['page_role'] !== 'home') {
                $errors[] = sprintf('%s section "%s" page_role must be "home" when set.', $contextLabel, $id);
            }
            if (array_key_exists('page_slug', $section) && array_key_exists('page_role', $section)) {
                $errors[] = sprintf('%s section "%s" cannot set both page_slug and page_role.', $contextLabel, $id);
            }
            if (!is_array($section['fields'] ?? null)) {
                $errors[] = sprintf('%s section "%s" requires fields array.', $contextLabel, $id);
                continue;
            }
            $errors = [...$errors, ...$this->validateFields($section['fields'], $contextLabel . ' section "' . $id . '"', 0)];
        }

        return $errors;
    }

    /**
     * @param array<int, mixed> $fields
     * @return list<string>
     */
    private function validateFields(array $fields, string $contextLabel, int $depth): array
    {
        $errors = [];
        if ($depth > 1) {
            return [$contextLabel . ': repeater nesting exceeds maximum depth (2 levels).'];
        }
        $fieldIds = [];
        foreach ($fields as $index => $field) {
            if (!is_array($field)) {
                $errors[] = sprintf('%s fields[%d] must be an object.', $contextLabel, $index);
                continue;
            }
            $id = $field['id'] ?? null;
            if (!is_string($id) || preg_match(self::ID_PATTERN, $id) !== 1) {
                $errors[] = sprintf('%s fields[%d].id is invalid.', $contextLabel, $index);
                continue;
            }
            if (isset($fieldIds[$id])) {
                $errors[] = sprintf('%s duplicate field id "%s".', $contextLabel, $id);
            }
            $fieldIds[$id] = true;
            $type = $field['type'] ?? null;
            if (!is_string($type) || !in_array($type, self::FIELD_TYPES, true)) {
                $errors[] = sprintf('%s field "%s" has unsupported type.', $contextLabel, $id);
                continue;
            }
            if (!is_string($field['label'] ?? null) || trim((string) $field['label']) === '') {
                $errors[] = sprintf('%s field "%s" requires label.', $contextLabel, $id);
            }
            if ($type === 'repeater') {
                if (!is_array($field['fields'] ?? null) || $field['fields'] === []) {
                    $errors[] = sprintf('%s repeater "%s" requires nested fields.', $contextLabel, $id);
                    continue;
                }
                $maxItems = $field['maxItems'] ?? null;
                if ($maxItems !== null && (!is_int($maxItems) || $maxItems < 1 || $maxItems > 100)) {
                    $errors[] = sprintf('%s repeater "%s" maxItems must be 1–100.', $contextLabel, $id);
                }
                $errors = [...$errors, ...$this->validateFields($field['fields'], $contextLabel . ' repeater "' . $id . '"', $depth + 1)];
            }
            if (in_array($type, ['select', 'button_style'], true)) {
                $options = $field['options'] ?? null;
                if (!is_array($options) || !array_is_list($options) || $options === []) {
                    $errors[] = sprintf('%s select field "%s" requires a non-empty options array.', $contextLabel, $id);
                } else {
                    $optionValues = [];
                    foreach ($options as $optionIndex => $option) {
                        if (!is_array($option) || !is_string($option['value'] ?? null) || !is_string($option['label'] ?? null) || trim($option['label']) === '') {
                            $errors[] = sprintf('%s select field "%s" option %d requires string value and non-empty label.', $contextLabel, $id, $optionIndex);
                            continue;
                        }
                        if (isset($optionValues[$option['value']])) {
                            $errors[] = sprintf('%s select field "%s" has duplicate option value "%s".', $contextLabel, $id, $option['value']);
                        }
                        $optionValues[$option['value']] = true;
                    }
                    if (array_key_exists('default', $field) && is_string($field['default']) && !isset($optionValues[$field['default']])) {
                        $errors[] = sprintf('%s select field "%s" default must match an option value.', $contextLabel, $id);
                    }
                }
            }
            if (isset($field['maxLength']) && (!is_int($field['maxLength']) || $field['maxLength'] < 1)) {
                $errors[] = sprintf('%s field "%s" maxLength must be a positive integer.', $contextLabel, $id);
            }
            if (array_key_exists('description', $field) && (!is_string($field['description']) || trim($field['description']) === '')) {
                $errors[] = sprintf('%s field "%s" description must be a non-empty string when set.', $contextLabel, $id);
            }
            if (array_key_exists('layout', $field) && !in_array($field['layout'], ['full', 'half'], true)) {
                $errors[] = sprintf('%s field "%s" layout must be \"full\" or \"half\" when set.', $contextLabel, $id);
            }
            if (array_key_exists('preview_background', $field) && ($type !== 'media' || !in_array($field['preview_background'], ['light', 'dark'], true))) {
                $errors[] = sprintf('%s field "%s" preview_background must be "light" or "dark" on a media field.', $contextLabel, $id);
            }
            if (array_key_exists('default', $field) && !$this->isValidDefault($type, $field['default'])) {
                $errors[] = sprintf('%s field "%s" default does not match its type.', $contextLabel, $id);
            }
        }

        return $errors;
    }

    /** `default` uses the same value shape as stored content for the field type. */
    private function isValidDefault(string $type, mixed $value): bool
    {
        return match ($type) {
            'checkbox' => is_bool($value),
            'color' => is_string($value) && preg_match('/^#[0-9a-fA-F]{6}$/', $value) === 1,
            'select', 'button_style' => is_string($value),
            'number' => $value === null || is_int($value) || is_float($value),
            'media', 'page_link' => $value === null || (is_int($value) && $value > 0),
            'repeater' => is_array($value) && array_is_list($value) && array_filter($value, static fn(mixed $row): bool => !is_array($row) || ($row !== [] && array_is_list($row))) === [],
            default => is_string($value),
        };
    }

    /**
     * @param array<string, mixed> $binding
     * @param array<int, true> $claimedPageIds
     * @param array<string, true> $claimedSlugs
     * @return list<string>
     */
    private function validatePageBindingMatch(array $binding, string $contextLabel, array &$claimedPageIds, array &$claimedSlugs): array
    {
        $errors = [];
        $hasMatch = false;
        if (array_key_exists('page_id', $binding)) {
            $hasMatch = true;
            if (!is_int($binding['page_id']) || $binding['page_id'] < 1) {
                $errors[] = $contextLabel . '.page_id must be a positive integer when set.';
            } elseif (isset($claimedPageIds[$binding['page_id']])) {
                $errors[] = sprintf('%s.page_id %d is already bound in another pages[] entry.', $contextLabel, $binding['page_id']);
            } else {
                $claimedPageIds[$binding['page_id']] = true;
            }
        }
        if (array_key_exists('page_ids', $binding)) {
            $hasMatch = true;
            if (!is_array($binding['page_ids']) || $binding['page_ids'] === []) {
                $errors[] = $contextLabel . '.page_ids must be a non-empty array of integers when set.';
            } else {
                foreach ($binding['page_ids'] as $pageIndex => $pageId) {
                    if (!is_int($pageId) || $pageId < 1) {
                        $errors[] = sprintf('%s.page_ids[%d] must be a positive integer.', $contextLabel, $pageIndex);
                        continue;
                    }
                    if (isset($claimedPageIds[$pageId])) {
                        $errors[] = sprintf('%s.page_ids[%d] (id %d) is already bound in another pages[] entry.', $contextLabel, $pageIndex, $pageId);
                    } else {
                        $claimedPageIds[$pageId] = true;
                    }
                }
            }
        }
        if (array_key_exists('slug', $binding)) {
            $hasMatch = true;
            $slug = $binding['slug'];
            if (!is_string($slug) || preg_match(self::ID_PATTERN, $slug) !== 1) {
                $errors[] = $contextLabel . '.slug must be a valid page slug when set.';
            } elseif (isset($claimedSlugs[$slug])) {
                $errors[] = sprintf('%s.slug "%s" is already bound in another pages[] entry.', $contextLabel, $slug);
            } else {
                $claimedSlugs[$slug] = true;
            }
        }
        if (array_key_exists('slugs', $binding)) {
            $hasMatch = true;
            if (!is_array($binding['slugs']) || $binding['slugs'] === []) {
                $errors[] = $contextLabel . '.slugs must be a non-empty array of slugs when set.';
            } else {
                foreach ($binding['slugs'] as $slugIndex => $slug) {
                    if (!is_string($slug) || preg_match(self::ID_PATTERN, $slug) !== 1) {
                        $errors[] = sprintf('%s.slugs[%d] must be a valid page slug.', $contextLabel, $slugIndex);
                        continue;
                    }
                    if (isset($claimedSlugs[$slug])) {
                        $errors[] = sprintf('%s.slugs[%d] ("%s") is already bound in another pages[] entry.', $contextLabel, $slugIndex, $slug);
                    } else {
                        $claimedSlugs[$slug] = true;
                    }
                }
            }
        }
        if (!$hasMatch) {
            $errors[] = $contextLabel . ' requires at least one of page_id, page_ids, slug, or slugs.';
        }

        return $errors;
    }

    /**
     * @param array<string, mixed> $ref
     * @return list<string>
     */
    private function validateFileRef(array $ref, string $contextLabel, string $baseDirectory): array
    {
        $errors = [];
        $file = $ref['file'] ?? null;
        if (!is_string($file) || trim($file) === '') {
            return [$contextLabel . '.file is required.'];
        }
        if (!is_string($ref['label'] ?? null) || trim((string) $ref['label']) === '') {
            $errors[] = $contextLabel . '.label is required.';
        }
        $path = $this->resolveThemeRelativePath($baseDirectory, $file);
        if ($path === null) {
            $errors[] = sprintf('%s file "%s" is missing or invalid.', $contextLabel, $file);
        }

        return $errors;
    }

    public function resolveThemeRelativePath(string $baseDirectory, string $relative): ?string
    {
        if ($relative === '' || str_contains($relative, '\\') || str_contains($relative, ':') || str_starts_with($relative, '/') || in_array('..', explode('/', $relative), true)) {
            return null;
        }
        $base = realpath($baseDirectory);
        if ($base === false) {
            return null;
        }
        $path = realpath($base . '/' . $relative);
        if ($path === false || !is_file($path) || !str_starts_with(str_replace('\\', '/', $path), str_replace('\\', '/', $base) . '/')) {
            return null;
        }

        return $path;
    }
}
